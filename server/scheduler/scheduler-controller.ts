import crypto from "node:crypto";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Scheduler:SchedulerController");
import {
  dbSchedulerStorage,
  dbCrewStorage,
  dbCrewExtensionsStorage,
  dbVesselStorage,
  vesselService,
} from "../repositories";
import { planShifts, generateDays } from "../crew-scheduler";
import type {
  InsertSchedulerRun,
  InsertScheduleAssignment,
  InsertScheduleUnfilled,
  SelectCrewAssignment,
} from "@shared/schema";
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

interface PlanParams {
  orgId: string;
  from?: string;
  days?: number;
  vessels?: string[];
  mode?: "dry_run" | "execute" | "auto" | "simulate";
  trigger?: string;
  triggerContext?: unknown;
  fillUnassignedOnly?: boolean;
}

export interface SimulatedAssignment {
  id: string;
  date: string;
  shiftId: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  start: string;
  end: string;
  role: string;
  whySelected: string;
  score: number;
  isNew: boolean;
  wouldCollide: boolean;
  collidesWithId?: string;
}

export interface SimulationResult {
  mode: "simulate";
  simulationId: string;
  stats: {
    duration_ms: number;
    proposed: number;
    unfilled: number;
    collisions: number;
    existingKept: number;
    reasons: Array<{ reason: string; count: number }>;
  };
  proposed: SimulatedAssignment[];
  unfilled: Array<{
    day: string;
    shiftId: string;
    need: number;
    reason: string;
  }>;
  collisions: Array<{
    proposedCrewId: string;
    proposedCrewName: string;
    existingAssignmentId: string;
    date: string;
    reason: string;
  }>;
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
  const existing = await loadExistingAssignments(orgId, since, daysArr[daysArr.length - 1]);

  // Calculate input hash for deduplication
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ daysArr, shifts, crew, leaves, portCalls, drydocks }))
    .digest("hex");

  // Deduplication check for auto mode - prevent redundant replans
  if (mode === "auto") {
    const existingRun = await dbSchedulerStorage.findRecentSchedulerRunByHash(orgId, inputHash);
    if (existingRun) {
      logger.info(`[Scheduler] Skipping redundant auto-replan: identical inputs within last 24h (run ${existingRun.id})`);
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
    const { scheduled, unfilled } = planShifts(daysArr, shifts, crew as object as Parameters<typeof planShifts>[2], leaves, existing as object as Parameters<typeof planShifts>[4]);
    const durationMs = Date.now() - t0;

    // Persist results
    if (mode === "execute" || mode === "auto") {
      // Clear old assignments in the date range to prevent conflicts
      if (mode === "auto" && daysArr.length > 0) {
        const startDate = new Date(daysArr[0]);
        const endDate = new Date(daysArr[daysArr.length - 1]);
        endDate.setHours(23, 59, 59, 999); // End of last day

        const deletedCount = await dbSchedulerStorage.deleteScheduleAssignmentsByDateRange(
          orgId,
          startDate,
          endDate
        );
        if (deletedCount > 0) {
          logger.info(`[Scheduler] Cleared ${deletedCount} existing auto assignments for date range ${daysArr[0]} to ${daysArr[daysArr.length - 1]}`);
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

    logger.info(`[Scheduler] Run completed: mode=${mode}, assigned=${scheduled.length}, unfilled=${stats.unfilled}, duration=${durationMs}ms, coverage=${coverage.toFixed(1)}%`);

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

// Helper functions
async function loadShiftTemplates(orgId: string, vessels?: string[]) {
  const allShifts = await dbCrewStorage.getShiftTemplates();
  const orgShifts = allShifts.filter((s) => !s.orgId || s.orgId === orgId);
  if (!vessels || vessels.length === 0) {
    return orgShifts;
  }
  return orgShifts.filter((s) => !s.vesselId || vessels.includes(s.vesselId));
}

async function loadCrewWithSkills(orgId: string) {
  const crew = await dbCrewStorage.getCrew(orgId);
  return Promise.all(
    crew.map(async (c) => {
      const skills = await dbCrewStorage.getCrewSkills(c.id);
      return { ...c, skills: skills.map((s) => s.skill) };
    })
  );
}

async function loadCrewLeaves(orgId: string) {
  const crew = await dbCrewStorage.getCrew(orgId);
  const allLeaves = await Promise.all(crew.map((c) => dbCrewStorage.getCrewLeave(c.id)));
  return allLeaves.flat();
}

async function loadPortCalls(orgId: string, vessels?: string[]) {
  const allPortCalls = await dbVesselStorage.getAllPortCalls(orgId);
  if (!vessels || vessels.length === 0) {
    return allPortCalls;
  }
  return allPortCalls.filter((pc) => vessels.includes(pc.vesselId));
}

async function loadDrydocks(orgId: string, vessels?: string[]) {
  const allDrydocks = await dbVesselStorage.getAllDrydockWindows(orgId);
  if (!vessels || vessels.length === 0) {
    return allDrydocks;
  }
  return allDrydocks.filter((d) => vessels.includes(d.vesselId));
}

async function loadCertifications(orgId: string) {
  const certsList = await (dbCrewExtensionsStorage.getCrewCertifications as (
    crewId: string | undefined,
    orgId: string
  ) => Promise<Array<{ crewId: string; [k: string]: unknown }>>)("", orgId);
  const certsMap: { [crewId: string]: Array<{ crewId: string; [k: string]: unknown }> } = {};
  for (const cert of certsList) {
    (certsMap[cert.crewId] ||= []).push(cert);
  }
  return certsMap;
}

async function loadExistingAssignments(
  orgId: string,
  from: string,
  to: string
): Promise<SelectCrewAssignment[]> {
  return dbCrewStorage.getCrewAssignmentsByDateRange(new Date(from), new Date(to));
}

function aggregateReasons(reasons: string[]): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of reasons) {
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return Array.from(map, ([reason, count]) => ({ reason, count }));
}

/**
 * Pure simulation mode - NO database writes
 * Returns in-memory proposals for preview before applying
 */
export async function simulateSchedule({
  orgId,
  from,
  days = 7,
  vessels,
  fillUnassignedOnly = true,
}: {
  orgId: string;
  from?: string;
  days?: number;
  vessels?: string[];
  fillUnassignedOnly?: boolean;
}): Promise<SimulationResult> {
  const t0 = Date.now();
  const since = from ?? new Date().toISOString().slice(0, 10);
  const daysArr = generateDays(since, days);

  // Load scheduling inputs (read-only)
  const shifts = await loadShiftTemplates(orgId, vessels);
  const crewList = await loadCrewWithSkills(orgId);
  const leaves = await loadCrewLeaves(orgId);
  const vesselsList = await vesselService.getVessels(orgId);
  const existing = await loadExistingAssignments(orgId, since, daysArr[daysArr.length - 1]);

  // Build lookup maps
  const crewMap = new Map(crewList.map((c) => [c.id, c]));
  const vesselMap = new Map(vesselsList.map((v) => [v.id, v]));
  const existingByDateCrew = new Map<string, SelectCrewAssignment>();
  for (const a of existing) {
    const key = `${a.date}-${a.crewId}`;
    existingByDateCrew.set(key, a);
  }

  // Filter existing to only published/confirmed if fillUnassignedOnly
  const protectedAssignments = fillUnassignedOnly
    ? existing.filter(
        (a) => a.status === "published" || a.status === "confirmed" || a.status === "scheduled"
      )
    : [];

  // Execute scheduling algorithm (in-memory)
  const { scheduled, unfilled, explanations } = planShiftsWithExplanations(
    daysArr,
    shifts,
    crewList,
    leaves,
    protectedAssignments
  );

  const durationMs = Date.now() - t0;
  const simulationId = crypto.randomUUID();

  // Build collision detection
  const collisions: SimulationResult["collisions"] = [];
  const proposed: SimulatedAssignment[] = [];

  for (const a of scheduled) {
    const existingKey = `${a.date}-${a.crewId}`;
    const existingAssignment = existingByDateCrew.get(existingKey);
    const crew = crewMap.get(a.crewId);
    const vessel = vesselMap.get(a.vesselId || "");

    const wouldCollide =
      !!existingAssignment &&
      (existingAssignment.status === "published" || existingAssignment.status === "confirmed");

    if (wouldCollide && existingAssignment) {
      collisions.push({
        proposedCrewId: a.crewId,
        proposedCrewName: crew?.name || "Unknown",
        existingAssignmentId: existingAssignment.id,
        date: a.date,
        reason: `Crew already has ${existingAssignment.status} assignment on this date`,
      });
    }

    proposed.push({
      id: `sim-${simulationId}-${proposed.length}`,
      date: a.date,
      shiftId: a.shiftId,
      crewId: a.crewId,
      crewName: crew?.name || "Unknown",
      vesselId: a.vesselId || "",
      vesselName: vessel?.name || "Unknown",
      start: a.start,
      end: a.end,
      role: a.role || "",
      whySelected:
        explanations?.[a.crewId] || "Best available match based on skills and availability",
      score: a.score || 0,
      isNew: !existingAssignment,
      wouldCollide,
      collidesWithId: wouldCollide ? existingAssignment?.id : undefined,
    });
  }

  const stats = {
    duration_ms: durationMs,
    proposed: proposed.length,
    unfilled: unfilled.reduce((sum, u) => sum + u.need, 0),
    collisions: collisions.length,
    existingKept: protectedAssignments.length,
    reasons: aggregateReasons(unfilled.map((u) => u.reason)),
  };

  logger.info(`[Scheduler] Simulation completed: proposed=${proposed.length}, unfilled=${stats.unfilled}, collisions=${collisions.length}, duration=${durationMs}ms`);

  return {
    mode: "simulate",
    simulationId,
    stats,
    proposed,
    unfilled,
    collisions,
  };
}

/**
 * Apply simulated schedule as drafts to the crew_assignments table
 * Only creates new assignments, never overwrites published ones
 */
export async function applySimulatedSchedule({
  orgId,
  simulationResult,
  skipCollisions = true,
  vesselIds,
}: {
  orgId: string;
  simulationResult: SimulationResult;
  skipCollisions?: boolean;
  vesselIds?: string[];
}): Promise<{
  applied: number;
  skipped: number;
  runId: string;
}> {
  // Filter by vesselIds first if provided (bulk vessel apply feature)
  let proposedSubset = simulationResult.proposed;
  if (vesselIds && vesselIds.length > 0) {
    const vesselIdSet = new Set(vesselIds);
    proposedSubset = proposedSubset.filter((p) => vesselIdSet.has(p.vesselId));
  }

  // Filter out collisions if requested (from the vessel-filtered subset)
  const toApply = skipCollisions ? proposedSubset.filter((p) => !p.wouldCollide) : proposedSubset;

  // Calculate skipped from the vessel-filtered subset, not full proposed
  const skipped = proposedSubset.length - toApply.length;

  // Determine date range from proposed assignments
  const dates = toApply.map((p) => new Date(p.date));
  const startDate =
    dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date();
  const endDate =
    dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();

  // Create a scheduler run record to track in Run History
  // When vesselIds filtering is applied, stats reflect the vessel subset
  const runRecord = await dbSchedulerStorage.createSchedulerRun({
    orgId,
    startedAt: new Date(),
    finishedAt: new Date(),
    mode: "generator",
    inputHash: `gen-${Date.now()}`,
    stats: {
      proposed: proposedSubset.length,
      applied: toApply.length,
      skipped,
      collisions: proposedSubset.filter((p) => p.wouldCollide).length,
      unfilled: simulationResult.unfilled?.reduce((sum, u) => sum + (u.need || 1), 0) || 0,
    },
    success: true,
    status: "completed",
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  });

  const runId = runRecord.id;

  // Create assignments in the crew_assignments table
  for (const p of toApply) {
    await dbCrewStorage.createCrewAssignment({
      orgId,
      date: p.date,
      shiftId: p.shiftId || null,
      crewId: p.crewId,
      vesselId: p.vesselId || null,
      start: new Date(p.start),
      end: new Date(p.end),
      role: p.role || null,
      status: "draft",
      generatedByRunId: runId,
      source: "generator",
    });
  }

  logger.info(`[Scheduler] Applied ${toApply.length} generated assignments as drafts (skipped ${skipped} collisions), runId=${runId}`);

  return {
    applied: toApply.length,
    skipped,
    runId,
  };
}

/**
 * Revert a generated schedule run - deletes only draft assignments from this run
 */
export async function revertGeneratedSchedule({
  orgId,
  runId,
}: {
  orgId: string;
  runId: string;
}): Promise<{ deleted: number }> {
  const deleted = await dbCrewStorage.deleteCrewAssignmentsByRunId(orgId, runId);

  logger.info(`[Scheduler] Reverted generated schedule: deleted ${deleted} draft assignments from run ${runId}`);

  return { deleted };
}

/**
 * Apply a scheduler run - promotes a draft/completed run to "published" status
 * so its assignments become active. Wraps dbSchedulerStorage.publishSchedulerRun
 * with org-scoped ownership validation.
 */
export async function applySchedule(
  runId: string,
  orgId: string
): Promise<{ runId: string; status: string }> {
  const run = await dbSchedulerStorage.getSchedulerRun(runId);
  if (!run || run.orgId !== orgId) {
    throw new Error(`Scheduler run ${runId} not found for org ${orgId}`);
  }
  const updated = await dbSchedulerStorage.publishSchedulerRun(runId, orgId);
  logger.info(`[Scheduler] Applied/published scheduler run ${runId} for org ${orgId}`);
  return { runId: updated.id, status: updated.status ?? "published" };
}

/**
 * Cancel a scheduler run - marks the run as cancelled and removes any
 * draft assignments that were generated from it. Org-scoped.
 */
export async function cancelScheduleRun(
  runId: string,
  orgId: string
): Promise<{ runId: string; status: string; deletedAssignments: number }> {
  const run = await dbSchedulerStorage.getSchedulerRun(runId);
  if (!run || run.orgId !== orgId) {
    throw new Error(`Scheduler run ${runId} not found for org ${orgId}`);
  }
  const deletedAssignments = await dbCrewStorage.deleteCrewAssignmentsByRunId(orgId, runId);
  const updated = await dbSchedulerStorage.cancelSchedulerRun(runId);
  logger.info(`[Scheduler] Cancelled scheduler run ${runId}: removed ${deletedAssignments} draft assignments`);
  return { runId: updated.id, status: updated.status ?? "cancelled", deletedAssignments };
}

/**
 * Clear all scheduler run history for an organization
 * Also cleans up associated crew assignments, schedule_assignments, and schedule_unfilled rows
 */
export async function clearSchedulerRunHistory(orgId: string): Promise<{ deleted: number }> {
  const runs = await dbSchedulerStorage.getSchedulerRuns(orgId);
  let totalAssignmentsDeleted = 0;

  // Clean up child tables BEFORE deleting parent runs
  // 1. Delete crew assignments generated by each run
  for (const run of runs) {
    const deleted = await dbCrewStorage.deleteCrewAssignmentsByRunId(orgId, run.id);
    totalAssignmentsDeleted += deleted;
  }

  // 2. Delete schedule_assignments and schedule_unfilled that reference runs
  await dbSchedulerStorage.deleteScheduleAssignmentsByOrg(orgId);
  await dbSchedulerStorage.deleteScheduleUnfilledByOrg(orgId);

  // 3. Finally delete the scheduler runs themselves
  await dbSchedulerStorage.deleteSchedulerRuns(orgId);

  logger.info(`[Scheduler] Cleared scheduler run history: deleted ${runs.length} runs and ${totalAssignmentsDeleted} associated crew assignments for org ${orgId}`);

  return { deleted: runs.length };
}

/**
 * Extended planShifts that includes explanations for why each crew was selected
 */
function planShiftsWithExplanations(
  daysArr: string[],
  shifts: Parameters<typeof planShifts>[1],
  crew: Array<{
    id: string;
    name?: string;
    rank?: string | null;
    vesselId?: string | null;
    skills?: string[];
  }>,
  leaves: Parameters<typeof planShifts>[3],
  existing: SelectCrewAssignment[]
): {
  scheduled: Array<{
    date: string;
    shiftId: string;
    crewId: string;
    vesselId?: string;
    start: string;
    end: string;
    role?: string;
    score?: number;
  }>;
  unfilled: Array<{ day: string; shiftId: string; need: number; reason: string }>;
  explanations: Record<string, string>;
} {
  // Use the existing planShifts and add explanations
  const { scheduled, unfilled } = planShifts(daysArr, shifts, crew as object as Parameters<typeof planShifts>[2], leaves, existing as object as Parameters<typeof planShifts>[4]);

  // Build explanations for each scheduled crew member
  const explanations: Record<string, string> = {};
  for (const s of scheduled) {
    const crewMember = crew.find((c) => c.id === s.crewId);
    if (crewMember) {
      const reasons: string[] = [];
      if ((crewMember.skills?.length ?? 0) > 0) {
        reasons.push(`Has ${crewMember.skills!.length} relevant skills`);
      }
      if (crewMember.vesselId === s.vesselId) {
        reasons.push("Currently assigned to this vessel");
      }
      if (crewMember.rank) {
        reasons.push(`Rank: ${crewMember.rank}`);
      }
      explanations[s.crewId] =
        reasons.length > 0 ? reasons.join(", ") : "Best available crew member";
    }
  }

  return { scheduled, unfilled, explanations };
}
