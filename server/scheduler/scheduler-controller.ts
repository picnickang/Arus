import crypto from "node:crypto";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Scheduler:SchedulerController");
import { dbSchedulerStorage } from "../repositories";
import { planShifts, generateDays } from "../crew-scheduler";
import type {
  InsertSchedulerRun,
  InsertScheduleAssignment,
  InsertScheduleUnfilled,
} from "@shared/schema";
import {
  aggregateReasons,
  loadCertifications,
  loadCrewLeaves,
  loadCrewWithSkills,
  loadDrydocks,
  loadExistingAssignments,
  loadPortCalls,
  loadShiftTemplates,
} from "./scheduler-controller-inputs.js";
import { simulateSchedule } from "./scheduler-controller-simulation.js";
import {
  schedRunDuration,
  schedUnfilledTotal,
  schedUnfilledReason,
  schedRunsTotal,
  schedAssignedShifts,
  schedCoveragePercent,
  schedDeduplicatedRuns,
  schedCleanupAssignments,
} from "../observability/scheduler-metrics";

export type { SimulatedAssignment, SimulationResult } from "./scheduler-controller-simulation.js";
export {
  applySimulatedSchedule,
  revertGeneratedSchedule,
  simulateSchedule,
} from "./scheduler-controller-simulation.js";
export {
  applySchedule,
  cancelScheduleRun,
  clearSchedulerRunHistory,
} from "./scheduler-controller-runs.js";

interface PlanParams {
  orgId: string;
  from?: string | undefined;
  days?: number | undefined;
  vessels?: string[] | undefined;
  mode?: "dry_run" | "execute" | "auto" | "simulate" | undefined;
  trigger?: string | undefined;
  triggerContext?: unknown;
  fillUnassignedOnly?: boolean | undefined;
}

export async function planAndMaybeExecute({
  orgId,
  from,
  days = 7,
  vessels,
  mode = "dry_run",
  trigger,
  triggerContext,
  fillUnassignedOnly = true,
}: PlanParams) {
  // Route to pure simulation mode (no DB writes)
  if (mode === "simulate") {
    return simulateSchedule({ orgId, from, days, vessels, fillUnassignedOnly });
  }

  const since = from ?? new Date().toISOString().slice(0, 10);
  const daysArr = generateDays(since, days);

  // Load scheduling inputs
  const shifts = await loadShiftTemplates(orgId, vessels);
  const crew = await loadCrewWithSkills(orgId);
  const leaves = await loadCrewLeaves(orgId);
  const portCalls = await loadPortCalls(orgId, vessels);
  const drydocks = await loadDrydocks(orgId, vessels);
  const certifications = await loadCertifications(orgId);
  const existing = await loadExistingAssignments(
    orgId,
    since,
    daysArr[daysArr.length - 1] ?? since
  );

  // Calculate input hash for deduplication
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ daysArr, shifts, crew, leaves, portCalls, drydocks }))
    .digest("hex");

  // Deduplication check for auto mode - prevent redundant replans
  if (mode === "auto") {
    const existingRun = await dbSchedulerStorage.findRecentSchedulerRunByHash(orgId, inputHash);
    if (existingRun) {
      logger.info(
        `[Scheduler] Skipping redundant auto-replan: identical inputs within last 24h (run ${existingRun.id})`
      );
      schedDeduplicatedRuns.labels(orgId, mode).inc();
      return {
        runId: existingRun.id,
        mode: "skipped",
        stats: existingRun.stats,
        scheduled: [],
        unfilled: [],
        deduplicated: true,
      };
    }
  }

  // Create scheduler run record
  const runData: InsertSchedulerRun = {
    orgId,
    startedAt: new Date(),
    mode,
    inputHash,
    stats: trigger ? { trigger, triggerContext } : undefined,
  };

  const run = await dbSchedulerStorage.createSchedulerRun(runData);
  const t0 = Date.now();

  try {
    // Execute scheduling algorithm
    const { scheduled, unfilled } = planShifts(
      daysArr,
      shifts,
      crew as object as Parameters<typeof planShifts>[2],
      leaves,
      existing as object as Parameters<typeof planShifts>[4]
    );
    const durationMs = Date.now() - t0;

    // Persist results
    if (mode === "execute" || mode === "auto") {
      // Clear old assignments in the date range to prevent conflicts
      if (mode === "auto" && daysArr.length > 0) {
        const startDate = new Date(daysArr[0] ?? since);
        const endDate = new Date(daysArr[daysArr.length - 1] ?? since);
        endDate.setHours(23, 59, 59, 999); // End of last day

        const deletedCount = await dbSchedulerStorage.deleteScheduleAssignmentsByDateRange(
          orgId,
          startDate,
          endDate
        );
        if (deletedCount > 0) {
          logger.info(
            `[Scheduler] Cleared ${deletedCount} existing auto assignments for date range ${daysArr[0]} to ${daysArr[daysArr.length - 1]}`
          );
          schedCleanupAssignments.labels(orgId, mode).inc(deletedCount);
        }
      }

      const assignmentRecords: InsertScheduleAssignment[] = scheduled.map((a) => ({
        runId: run.id,
        orgId,
        date: a.date,
        shiftId: a.shiftId,
        crewId: a.crewId,
        vesselId: a.vesselId,
        start: new Date(a.start),
        end: new Date(a.end),
        role: a.role,
        executed: true,
      }));

      await dbSchedulerStorage.createBulkScheduleAssignments(assignmentRecords);
    }

    // Always persist unfilled data for analysis
    const unfilledRecords: InsertScheduleUnfilled[] = unfilled.map((u) => ({
      runId: run.id,
      orgId,
      day: u.day,
      shiftId: u.shiftId,
      need: u.need,
      reason: u.reason,
    }));

    await dbSchedulerStorage.createBulkScheduleUnfilled(unfilledRecords);

    // Aggregate stats
    const stats = {
      duration_ms: durationMs,
      assigned: scheduled.length,
      unfilled: unfilled.reduce((sum, u) => sum + u.need, 0),
      reasons: aggregateReasons(unfilled.map((u) => u.reason)),
      trigger,
      triggerContext,
    };

    // Update run with results
    await dbSchedulerStorage.updateSchedulerRun(run.id, {
      finishedAt: new Date(),
      success: true,
      stats,
    });

    // Collect Prometheus metrics
    schedRunDuration.labels(orgId, mode, trigger || "manual").observe(durationMs);
    schedRunsTotal.labels(orgId, mode, trigger || "manual", "success").inc();

    // Track assigned shifts per vessel
    for (const assignment of scheduled) {
      schedAssignedShifts.labels(orgId, assignment.vesselId || "unassigned").inc();
    }

    // Track unfilled positions per vessel
    for (const u of unfilled) {
      const vesselId = shifts.find((s) => s.id === u.shiftId)?.vesselId || "unknown";
      schedUnfilledTotal.labels(orgId, vesselId).inc(u.need);
    }

    // Track unfilled by reason
    for (const { reason, count } of stats.reasons) {
      schedUnfilledReason.labels(orgId, reason).inc(count);
    }

    // Calculate and track coverage percentage
    const totalNeeded = shifts.length * daysArr.length;
    const coverage = totalNeeded > 0 ? (scheduled.length / totalNeeded) * 100 : 0;
    schedCoveragePercent.labels(orgId).set(coverage);

    logger.info(
      `[Scheduler] Run completed: mode=${mode}, assigned=${scheduled.length}, unfilled=${stats.unfilled}, duration=${durationMs}ms, coverage=${coverage.toFixed(1)}%`
    );

    return { runId: run.id, mode, stats, scheduled, unfilled };
  } catch (error) {
    // Mark run as failed
    await dbSchedulerStorage.updateSchedulerRun(run.id, {
      finishedAt: new Date(),
      success: false,
      stats: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    // Track failed runs
    schedRunsTotal.labels(orgId, mode, trigger || "manual", "failed").inc();

    throw error;
  }
}
