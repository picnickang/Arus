// @ts-nocheck
/**
 * HoR Constraint Checker
 *
 * Checks if a crew member can be assigned to a shift based on their
 * existing rest hours and projected compliance.
 */

import { dbStcwStorage, dbCrewStorage } from "../../repositories";
import { calculateFatigueRisk } from "../../stcw-compliance";
import type { RestDay } from "../../stcw-compliance";
import { projectRestHoursFromAssignments, mergeExistingRestWithProjected } from "./projector";
import type { DraftAssignment, CanAssignResult, ProjectionViolation, RestHourFlags } from "./types";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:HorProjector:ConstraintChecker");

const STCW_MIN_REST_24 = 10;
const STCW_MAX_WORK_7D = 91;

export async function getCrewExistingRestDays(
  crewId: string,
  startDate: string,
  endDate: string
): Promise<RestDay[]> {
  try {
    const restData = await dbStcwStorage.getCrewRestRange(crewId, startDate, endDate);

    if (!restData?.days || restData.days.length === 0) {
      return [];
    }

    return restData.days.map((day) => ({
      date: day.date,
      h0: day.h0 ?? 1,
      h1: day.h1 ?? 1,
      h2: day.h2 ?? 1,
      h3: day.h3 ?? 1,
      h4: day.h4 ?? 1,
      h5: day.h5 ?? 1,
      h6: day.h6 ?? 1,
      h7: day.h7 ?? 1,
      h8: day.h8 ?? 1,
      h9: day.h9 ?? 1,
      h10: day.h10 ?? 1,
      h11: day.h11 ?? 1,
      h12: day.h12 ?? 1,
      h13: day.h13 ?? 1,
      h14: day.h14 ?? 1,
      h15: day.h15 ?? 1,
      h16: day.h16 ?? 1,
      h17: day.h17 ?? 1,
      h18: day.h18 ?? 1,
      h19: day.h19 ?? 1,
      h20: day.h20 ?? 1,
      h21: day.h21 ?? 1,
      h22: day.h22 ?? 1,
      h23: day.h23 ?? 1,
    }));
  } catch (error) {
    logger.error(`Failed to fetch rest days for crew ${crewId}:`, undefined, error);
    return [];
  }
}

function calculateRestInLast24h(
  daysMap: Map<string, RestHourFlags>,
  targetDate: string,
  targetHour: number
): number {
  let restCount = 0;
  const target = new Date(`${targetDate}T${targetHour.toString().padStart(2, "0")}:00:00`);

  for (let h = 0; h < 24; h++) {
    const checkTime = new Date(target.getTime() - h * 60 * 60 * 1000);
    const checkDate = checkTime.toISOString().split("T")[0];
    const checkHour = checkTime.getHours();

    const dayFlags = daysMap.get(checkDate);
    if (dayFlags) {
      const key = `h${checkHour}` as keyof RestHourFlags;
      if (dayFlags[key] === 1) {
        restCount++;
      }
    }
  }

  return restCount;
}

function calculateWorkInLast7Days(daysMap: Map<string, RestHourFlags>, targetDate: string): number {
  let workCount = 0;
  const target = new Date(targetDate);

  for (let d = 0; d < 7; d++) {
    const checkDate = new Date(target);
    checkDate.setDate(checkDate.getDate() - d);
    const dateStr = checkDate.toISOString().split("T")[0];

    const dayFlags = daysMap.get(dateStr);
    if (dayFlags) {
      for (let h = 0; h < 24; h++) {
        const key = `h${h}` as keyof RestHourFlags;
        if (dayFlags[key] === 0) {
          workCount++;
        }
      }
    }
  }

  return workCount;
}

export async function canAssignCrew(
  crewId: string,
  proposedAssignment: DraftAssignment,
  existingAssignments?: DraftAssignment[]
): Promise<CanAssignResult> {
  const violations: ProjectionViolation[] = [];

  let rosterVesselId: string | null = null;
  try {
    const crewMembers = await dbCrewStorage.getCrew();
    const crewMember = crewMembers.find((c) => c.id === crewId);
    if (crewMember) {
      rosterVesselId = crewMember.vesselId || null;

      if (
        rosterVesselId &&
        proposedAssignment.vesselId &&
        rosterVesselId !== proposedAssignment.vesselId
      ) {
        const assignmentDate = new Date(proposedAssignment.start).toISOString().split("T")[0];
        violations.push({
          crewId,
          date: assignmentDate,
          rule: "vessel_roster_mismatch",
          severity: "warning",
          description: `Crew member's home vessel differs from assignment vessel`,
          currentValue: 0,
          threshold: 0,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to check crew roster:", undefined, error);
  }

  const proposedStart = new Date(proposedAssignment.start);
  const proposedEnd = new Date(proposedAssignment.end);

  const lookbackStart = new Date(proposedStart);
  lookbackStart.setDate(lookbackStart.getDate() - 7);
  const lookbackEnd = new Date(proposedEnd);
  lookbackEnd.setDate(lookbackEnd.getDate() + 1);

  const startStr = lookbackStart.toISOString().split("T")[0];
  const endStr = lookbackEnd.toISOString().split("T")[0];

  const existingRestDays = await getCrewExistingRestDays(crewId, startStr, endStr);

  const existingMap = mergeExistingRestWithProjected(existingRestDays, crewId);
  const crewExistingMap = new Map<string, Map<string, RestHourFlags>>();
  crewExistingMap.set(crewId, new Map(existingMap));

  let storedAssignments: DraftAssignment[] = [];
  try {
    const allStoredAssignments = await dbCrewStorage.getCrewAssignments("" as any, {});
    storedAssignments = allStoredAssignments
      .filter((a) => a.crewId === crewId && a.id !== proposedAssignment.id)
      .filter((a) => {
        const aStart = new Date(a.start);
        const aEnd = new Date(a.end);
        return aEnd >= lookbackStart && aStart <= lookbackEnd;
      })
      .map((a) => ({
        id: a.id,
        crewId: a.crewId,
        vesselId: a.vesselId,
        start: a.start,
        end: a.end,
        shiftName: a.shiftName,
        position: a.position,
      }));
  } catch (error) {
    logger.error("Failed to fetch stored assignments:", undefined, error);
  }

  const draftAssignments = (existingAssignments?.filter((a) => a.crewId === crewId) || []).filter(
    (a) => a.id !== proposedAssignment.id
  );

  const allAssignments = [proposedAssignment, ...storedAssignments, ...draftAssignments];

  const projectedMap = projectRestHoursFromAssignments(allAssignments, crewExistingMap);
  const crewDays = projectedMap.get(crewId) || new Map();

  const proposedDateStr = proposedStart.toISOString().split("T")[0];
  const proposedHour = proposedStart.getHours();

  const projectedRest = calculateRestInLast24h(crewDays, proposedDateStr, proposedHour);
  const projectedWork = calculateWorkInLast7Days(crewDays, proposedDateStr);

  if (projectedRest < STCW_MIN_REST_24) {
    violations.push({
      crewId,
      date: proposedDateStr,
      rule: "10h_24h",
      severity: "error",
      description: `Would have only ${projectedRest}h rest in 24h period (min: 10h)`,
      currentValue: projectedRest,
      threshold: STCW_MIN_REST_24,
    });
  }

  if (projectedWork > STCW_MAX_WORK_7D) {
    violations.push({
      crewId,
      date: proposedDateStr,
      rule: "77h_7d",
      severity: "error",
      description: `Would work ${projectedWork}h in 7 days (max: ${STCW_MAX_WORK_7D}h)`,
      currentValue: projectedWork,
      threshold: STCW_MAX_WORK_7D,
    });
  }

  const restDaysArray: RestDay[] = Array.from(crewDays.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, flags]) => ({
      date,
      ...flags,
    }));

  let fatigueRisk: CanAssignResult["fatigueRisk"];
  try {
    const fatigueResult = calculateFatigueRisk(crewId, restDaysArray);
    fatigueRisk = fatigueResult.riskLevel;

    if (fatigueRisk === "high" || fatigueRisk === "critical") {
      violations.push({
        crewId,
        date: proposedDateStr,
        rule: "10h_24h",
        severity: fatigueRisk === "critical" ? "error" : "warning",
        description: `Fatigue risk level: ${fatigueRisk}`,
      });
    }
  } catch {
    fatigueRisk = undefined;
  }

  const hasErrors = violations.some((v) => v.severity === "error");

  return {
    canAssign: !hasErrors,
    violations,
    projectedRestHours: projectedRest,
    projectedWeeklyWork: projectedWork,
    fatigueRisk,
  };
}

export async function checkAssignmentOverlap(
  crewId: string,
  proposedStart: Date,
  proposedEnd: Date,
  excludeAssignmentId?: string
): Promise<{ hasOverlap: boolean; overlappingAssignments: string[] }> {
  try {
    const allAssignments = await dbCrewStorage.getCrewAssignments("" as any, {});
    const crewAssignments = allAssignments.filter(
      (a) => a.crewId === crewId && a.id !== excludeAssignmentId
    );

    const overlapping: string[] = [];

    for (const assignment of crewAssignments) {
      const existingStart = new Date(assignment.start);
      const existingEnd = new Date(assignment.end);

      const hasOverlap =
        (proposedStart >= existingStart && proposedStart < existingEnd) ||
        (proposedEnd > existingStart && proposedEnd <= existingEnd) ||
        (proposedStart <= existingStart && proposedEnd >= existingEnd);

      if (hasOverlap) {
        overlapping.push(assignment.id);
      }
    }

    return {
      hasOverlap: overlapping.length > 0,
      overlappingAssignments: overlapping,
    };
  } catch (error) {
    logger.error("Failed to check assignment overlap:", undefined, error);
    return { hasOverlap: false, overlappingAssignments: [] };
  }
}

export async function validateAssignment(
  crewId: string,
  proposedAssignment: DraftAssignment,
  existingAssignments?: DraftAssignment[]
): Promise<{
  valid: boolean;
  canAssign: CanAssignResult;
  overlap: { hasOverlap: boolean; overlappingAssignments: string[] };
}> {
  const [canAssignResult, overlapResult] = await Promise.all([
    canAssignCrew(crewId, proposedAssignment, existingAssignments),
    checkAssignmentOverlap(
      crewId,
      new Date(proposedAssignment.start),
      new Date(proposedAssignment.end),
      proposedAssignment.id
    ),
  ]);

  return {
    valid: canAssignResult.canAssign && !overlapResult.hasOverlap,
    canAssign: canAssignResult,
    overlap: overlapResult,
  };
}
