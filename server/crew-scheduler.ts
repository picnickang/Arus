// @ts-nocheck
/**
 * Crew Scheduler - Greedy Shift Assignment Algorithm
 *
 * Assigns crew members to shift templates for a date range while respecting:
 * - Skills and vessel assignments
 * - Leave periods
 * - Minimum rest requirements
 * - Maximum weekly hours (STCW compliance)
 */

import type { SelectShiftTemplate, SelectCrewLeave } from "@shared/schema";

export interface CrewWithSkills {
  id: string;
  active: boolean;
  rank?: string | null;
  skills: string[];
  vesselId?: string | null;
  minRestH?: number | null;
  maxHours7d?: number | null;
}

export interface Assignment {
  date: string;
  shiftId: string;
  crewId: string;
  vesselId?: string;
  start: string;
  end: string;
  role?: string;
}

export interface UnfilledShift {
  day: string;
  shiftId: string;
  need: number;
  reason: string;
}

function parseIso(s: string): Date {
  return new Date(s);
}

function overlaps(s1: Date, e1: Date, s2: Date, e2: Date): boolean {
  return s1 < e2 && e1 > s2;
}

function hoursInRange(
  assignments: Assignment[],
  crewId: string,
  weekStart: Date,
  weekEnd: Date
): number {
  let total = 0;

  for (const assignment of assignments) {
    if (assignment.crewId !== crewId) {
      continue;
    }

    const start = parseIso(assignment.start);
    const end = parseIso(assignment.end);
    const lo = new Date(Math.max(start.getTime(), weekStart.getTime()));
    const hi = new Date(Math.min(end.getTime(), weekEnd.getTime()));

    if (lo < hi) {
      total += (hi.getTime() - lo.getTime()) / (1000 * 60 * 60);
    }
  }

  return total;
}

function restOk(assignments: Assignment[], crewId: string, start: Date, minRestH: number): boolean {
  let lastEnd: Date | null = null;

  for (const assignment of assignments) {
    if (assignment.crewId !== crewId) {
      continue;
    }
    const end = parseIso(assignment.end);
    if (end <= start && (lastEnd === null || end > lastEnd)) {
      lastEnd = end;
    }
  }

  if (lastEnd === null) {
    return true;
  }
  const restHours = (start.getTime() - lastEnd.getTime()) / (1000 * 60 * 60);
  return restHours >= minRestH;
}

function buildLeaveIndex(leaves: SelectCrewLeave[]): Map<string, Array<[Date, Date]>> {
  const leaveIndex = new Map<string, Array<[Date, Date]>>();
  for (const leave of leaves) {
    const start = new Date(leave.start);
    const end = new Date(leave.end);
    if (!leaveIndex.has(leave.crewId)) {
      leaveIndex.set(leave.crewId, []);
    }
    leaveIndex.get(leave.crewId)!.push([start, end]);
  }
  return leaveIndex;
}

function isOnLeave(
  leaveIndex: Map<string, Array<[Date, Date]>>,
  crewId: string,
  start: Date,
  end: Date
): boolean {
  const crewLeaves = leaveIndex.get(crewId) ?? [];
  return crewLeaves.some(([leaveStart, leaveEnd]) => overlaps(leaveStart, leaveEnd, start, end));
}

function rankCrew(crew: CrewWithSkills[], vesselId?: string | null): CrewWithSkills[] {
  return [...crew].sort((a, b) => {
    const aVesselMatch = !vesselId || a.vesselId === vesselId ? 0 : 1;
    const bVesselMatch = !vesselId || b.vesselId === vesselId ? 0 : 1;
    if (aVesselMatch !== bVesselMatch) {
      return aVesselMatch - bVesselMatch;
    }
    return (a.rank ?? "").localeCompare(b.rank ?? "");
  });
}

function canAssignCrewMember(
  crewMember: CrewWithSkills,
  shift: SelectShiftTemplate,
  start: Date,
  end: Date,
  assignments: Assignment[],
  leaveIndex: Map<string, Array<[Date, Date]>>
): boolean {
  if (!crewMember.active) {
    return false;
  }

  const crewId = crewMember.id;
  const minRest = crewMember.minRestH ?? 10;
  const max7d = crewMember.maxHours7d ?? 72;

  if (shift.requiredSkills && !crewMember.skills.includes(shift.requiredSkills)) {
    return false;
  }
  if (shift.vesselId && crewMember.vesselId && crewMember.vesselId !== shift.vesselId) {
    return false;
  }
  if (isOnLeave(leaveIndex, crewId, start, end)) {
    return false;
  }
  if (!restOk(assignments, crewId, start, minRest)) {
    return false;
  }

  const weekStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(start.getTime() + 1);
  const shiftHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  if (hoursInRange(assignments, crewId, weekStart, weekEnd) + shiftHours > max7d) {
    return false;
  }

  return true;
}

function processShift(
  day: string,
  shift: SelectShiftTemplate,
  crew: CrewWithSkills[],
  assignments: Assignment[],
  leaveIndex: Map<string, Array<[Date, Date]>>,
  unfilled: UnfilledShift[]
): void {
  const start = new Date(`${day}T${shift.start}`);
  const end = new Date(`${day}T${shift.end}`);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  const needed = shift.needed ?? 1;
  const rankedCrew = rankCrew(crew, shift.vesselId);
  let picked = 0;

  for (const crewMember of rankedCrew) {
    if (picked >= needed) {
      break;
    }

    if (!canAssignCrewMember(crewMember, shift, start, end, assignments, leaveIndex)) {
      continue;
    }

    assignments.push({
      date: day,
      shiftId: shift.id!,
      crewId: crewMember.id,
      vesselId: shift.vesselId ?? undefined,
      start: start.toISOString(),
      end: end.toISOString(),
      role: shift.role ?? undefined,
    });

    picked++;
  }

  if (picked < needed) {
    unfilled.push({
      day,
      shiftId: shift.id,
      need: needed - picked,
      reason: "insufficient crew for constraints",
    });
  }
}

export function planShifts(
  days: string[],
  shifts: SelectShiftTemplate[],
  crew: CrewWithSkills[],
  leaves: SelectCrewLeave[],
  existing: Assignment[] = []
): { scheduled: Assignment[]; unfilled: UnfilledShift[] } {
  const assignments: Assignment[] = [...existing];
  const unfilled: UnfilledShift[] = [];
  const leaveIndex = buildLeaveIndex(leaves);

  for (const day of days) {
    for (const shift of shifts) {
      processShift(day, shift, crew, assignments, leaveIndex, unfilled);
    }
  }

  return { scheduled: assignments, unfilled };
}

export function generateDays(startDate: string, numDays: number): string[] {
  const days: string[] = [];
  const base = new Date(startDate);

  for (let i = 0; i < numDays; i++) {
    const date = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    days.push(date.toISOString().slice(0, 10));
  }

  return days;
}
