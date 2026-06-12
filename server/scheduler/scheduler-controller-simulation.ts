import crypto from "node:crypto";
import { createLogger } from "../lib/structured-logger";
import { dbCrewStorage, dbSchedulerStorage, vesselService } from "../repositories";
import { generateDays, planShifts } from "../crew-scheduler";
import type { SelectCrewAssignment } from "@shared/schema";
import {
  aggregateReasons,
  loadCrewLeaves,
  loadCrewWithSkills,
  loadExistingAssignments,
  loadShiftTemplates,
} from "./scheduler-controller-inputs.js";

const logger = createLogger("Scheduler:SchedulerController");

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
  collidesWithId?: string | undefined;
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
  from?: string | undefined;
  days?: number | undefined;
  vessels?: string[] | undefined;
  fillUnassignedOnly?: boolean | undefined;
}): Promise<SimulationResult> {
  const t0 = Date.now();
  const since = from ?? new Date().toISOString().slice(0, 10);
  const daysArr = generateDays(since, days);

  // Load scheduling inputs (read-only)
  const shifts = await loadShiftTemplates(orgId, vessels);
  const crewList = await loadCrewWithSkills(orgId);
  const leaves = await loadCrewLeaves(orgId);
  const vesselsList = await vesselService.getVessels(orgId);
  const existing = await loadExistingAssignments(
    orgId,
    since,
    daysArr[daysArr.length - 1] ?? since
  );

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

  logger.info(
    `[Scheduler] Simulation completed: proposed=${proposed.length}, unfilled=${stats.unfilled}, collisions=${collisions.length}, duration=${durationMs}ms`
  );

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
  skipCollisions?: boolean | undefined;
  vesselIds?: string[] | undefined;
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

  logger.info(
    `[Scheduler] Applied ${toApply.length} generated assignments as drafts (skipped ${skipped} collisions), runId=${runId}`
  );

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

  logger.info(
    `[Scheduler] Reverted generated schedule: deleted ${deleted} draft assignments from run ${runId}`
  );

  return { deleted };
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
    vesselId?: string | undefined;
    start: string;
    end: string;
    role?: string | undefined;
    score?: number | undefined;
  }>;
  unfilled: Array<{ day: string; shiftId: string; need: number; reason: string }>;
  explanations: Record<string, string>;
} {
  // Use the existing planShifts and add explanations
  const { scheduled, unfilled } = planShifts(
    daysArr,
    shifts,
    crew as object as Parameters<typeof planShifts>[2],
    leaves,
    existing as object as Parameters<typeof planShifts>[4]
  );

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
