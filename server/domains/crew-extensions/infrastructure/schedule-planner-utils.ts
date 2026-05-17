// @ts-nocheck
/**
 * Schedule Planner Utilities
 * Pure functions for schedule planner read model calculations
 * Extracted for testability without database dependencies
 */

import type {
  SchedulePlannerRow,
  ScheduleDayCell,
  CrewMemberSummary,
  VesselSummary,
  UnfilledShiftSummary,
  ScheduleViolation,
} from "../domain/read-models";

export function mapShift(shift: string | null): "day" | "night" | "full_day" {
  switch (shift?.toLowerCase()) {
    case "day":
      return "day";
    case "night":
      return "night";
    case "full_day":
    case "full":
      return "full_day";
    default:
      return "day";
  }
}

export function mapStatus(
  status: string | null
): "proposed" | "approved" | "applied" | "cancelled" {
  switch (status?.toLowerCase()) {
    case "proposed":
      return "proposed";
    case "approved":
      return "approved";
    case "applied":
      return "applied";
    case "cancelled":
      return "cancelled";
    default:
      return "proposed";
  }
}

export function formatDate(value: Date | null): string {
  if (!value) {
    return "";
  }
  return value.toISOString().split("T")[0];
}

export function calculateTotalHours(assignments: ScheduleDayCell[]): number {
  return assignments.reduce((sum, a) => {
    switch (a.shift) {
      case "day":
      case "night":
        return sum + 8;
      case "full_day":
        return sum + 12;
      default:
        return sum + 8;
    }
  }, 0);
}

export function calculateComplianceRate(rows: SchedulePlannerRow[]): number {
  if (rows.length === 0) {
    return 100;
  }
  const totalScore = rows.reduce((sum, r) => sum + r.complianceScore, 0);
  return Math.round(totalScore / rows.length);
}

export function calculateUtilization(
  rows: SchedulePlannerRow[],
  startDate: string,
  endDate: string
): number {
  if (rows.length === 0) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const maxHoursPerCrew = totalDays * 8;

  const totalHours = rows.reduce((sum, r) => sum + r.totalHours, 0);
  const maxPossibleHours = rows.length * maxHoursPerCrew;

  return maxPossibleHours > 0 ? Math.round((totalHours / maxPossibleHours) * 100) : 0;
}

export function detectViolations(
  assignments: ScheduleDayCell[],
  crewMember: CrewMemberSummary
): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];

  const dateMap = new Map<string, ScheduleDayCell[]>();
  for (const a of assignments) {
    const list = dateMap.get(a.date) || [];
    list.push(a);
    dateMap.set(a.date, list);
  }

  dateMap.forEach((dayAssignments, date) => {
    if (dayAssignments.length > 1) {
      violations.push({
        type: "overlap",
        severity: "error",
        message: `Multiple assignments on ${date}`,
        affectedDates: [date],
        crewId: crewMember.id,
      });
    }
  });

  if (crewMember.hoursWorkedThisWeek > 72) {
    violations.push({
      type: "hours_exceeded",
      severity: "warning",
      message: `Weekly hours (${crewMember.hoursWorkedThisWeek}h) exceeds 72h limit`,
      affectedDates: [],
      crewId: crewMember.id,
    });
  }

  if (crewMember.certificationStatus === "expired") {
    violations.push({
      type: "certification_expired",
      severity: "error",
      message: "One or more certifications have expired",
      affectedDates: [],
      crewId: crewMember.id,
    });
  } else if (crewMember.certificationStatus === "expiring") {
    violations.push({
      type: "certification_expiring",
      severity: "warning",
      message: "Certification expiring within 30 days",
      affectedDates: [],
      crewId: crewMember.id,
    });
  }

  return violations;
}

export function buildUnfilledShifts(
  unfilled: UnfilledShiftSummary[],
  vesselMap: Map<string, VesselSummary>,
  crewMembers: CrewMemberSummary[]
): UnfilledShiftSummary[] {
  return unfilled.map((u) => ({
    ...u,
    candidateCrew: crewMembers
      .filter((c) => c.availability === "available" && (!u.role || c.role === u.role))
      .slice(0, 5)
      .map((c) => c.id),
  }));
}

export function buildRows(
  crewMembers: CrewMemberSummary[],
  assignments: ScheduleDayCell[],
  vesselMap: Map<string, VesselSummary>
): SchedulePlannerRow[] {
  const assignmentsByCrewId = new Map<string, ScheduleDayCell[]>();

  for (const assignment of assignments) {
    const list = assignmentsByCrewId.get(assignment.crewId) || [];
    list.push(assignment);
    assignmentsByCrewId.set(assignment.crewId, list);
  }

  return crewMembers.map((crewMember) => {
    const crewAssignments = assignmentsByCrewId.get(crewMember.id) || [];
    const violations = detectViolations(crewAssignments, crewMember);
    const totalHours = calculateTotalHours(crewAssignments);
    const complianceScore =
      violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 10);

    for (const assignment of crewAssignments) {
      const relatedViolation = violations.find(
        (v) =>
          v.assignmentId === assignment.assignmentId || v.affectedDates.includes(assignment.date)
      );
      if (relatedViolation) {
        assignment.hasViolation = true;
      }
    }

    return {
      crew: crewMember,
      assignments: crewAssignments,
      totalHours,
      complianceScore,
      violations,
    };
  });
}

export class RefreshDebouncer {
  private lastRefreshTime: Map<string, number> = new Map();

  constructor(private refreshDebounceMs: number = 5000) {}

  shouldDebounce(orgId: string): boolean {
    const now = Date.now();
    const lastRefresh = this.lastRefreshTime.get(orgId) || 0;
    return now - lastRefresh < this.refreshDebounceMs;
  }

  recordRefresh(orgId: string): void {
    this.lastRefreshTime.set(orgId, Date.now());
  }

  setDebounceMs(ms: number): void {
    this.refreshDebounceMs = ms;
  }
}
