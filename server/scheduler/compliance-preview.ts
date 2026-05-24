import { dbCrewStorage } from "../repositories";
import { checkMonthCompliance, type RestDay } from "../stcw-compliance";
import type {
  DayComplianceResult,
  RollingComplianceResult,
} from "../stcw-compliance/types";
import {
  initializeRestHours,
  markWorkHoursForDay,
  getWorkHoursForDate,
  getDatesInRange,
} from "./hor-generator";

interface ScheduleAssignment {
  id?: string;
  crewId: string;
  crewName?: string;
  start: string | Date;
  end: string | Date;
  shiftName?: string;
  position?: string;
}

export interface ComplianceViolation {
  crewId: string;
  crewName: string;
  date: string;
  rule: "10h_24h" | "77h_7d" | "split_rest" | "consecutive_days";
  description: string;
  severity: "warning" | "violation";
  restHours?: number;
  requiredHours?: number;
}

export interface PreviewComplianceResponse {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  summary: {
    totalCrew: number;
    compliantCrew: number;
    violationCount: number;
    warningCount: number;
  };
  crewDetails: Array<{
    crewId: string;
    crewName: string;
    isCompliant: boolean;
    violationCount: number;
    warningCount: number;
  }>;
}

type RestHourFlags = {
  h0: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  h7: number;
  h8: number;
  h9: number;
  h10: number;
  h11: number;
  h12: number;
  h13: number;
  h14: number;
  h15: number;
  h16: number;
  h17: number;
  h18: number;
  h19: number;
  h20: number;
  h21: number;
  h22: number;
  h23: number;
};

function convertToRestDay(dateStr: string, hours: RestHourFlags): RestDay {
  return {
    date: dateStr,
    ...hours,
  };
}

function buildCrewRestDaysFromAssignments(
  assignments: ScheduleAssignment[]
): Map<string, Map<string, RestHourFlags>> {
  const crewDaysMap = new Map<string, Map<string, RestHourFlags>>();

  for (const assignment of assignments) {
    const startTime = new Date(assignment.start);
    const endTime = new Date(assignment.end);

    const datesAffected = getDatesInRange(startTime, endTime);

    for (const dateStr of datesAffected) {
      if (!crewDaysMap.has(assignment.crewId)) {
        crewDaysMap.set(assignment.crewId, new Map());
      }

      const crewDays = crewDaysMap.get(assignment.crewId)!;

      if (!crewDays.has(dateStr)) {
        crewDays.set(dateStr, initializeRestHours());
      }

      const workHours = getWorkHoursForDate(startTime, endTime, dateStr);
      const currentFlags = crewDays.get(dateStr)!;
      const updatedFlags = markWorkHoursForDay(currentFlags, workHours);
      crewDays.set(dateStr, updatedFlags);
    }
  }

  return crewDaysMap;
}

interface CrewDetail {
  crewId: string;
  crewName: string;
  isCompliant: boolean;
  violationCount: number;
  warningCount: number;
}

function add24hViolation(
  crewId: string,
  crewName: string,
  dayResult: DayComplianceResult,
  violations: ComplianceViolation[],
  detail: CrewDetail
): void {
  const deficit = 10 - dayResult.min_rest_24;
  const severity: "warning" | "violation" = deficit >= 3 ? "violation" : "warning";

  violations.push({
    crewId,
    crewName,
    date: dayResult.date,
    rule: "10h_24h",
    description: `Only ${dayResult.min_rest_24}h rest in 24h period (minimum 10h required)`,
    severity,
    restHours: dayResult.min_rest_24,
    requiredHours: 10,
  });

  if (severity === "violation") {
    detail.violationCount++;
  } else {
    detail.warningCount++;
  }
  detail.isCompliant = false;
}

function addSplitViolation(
  crewId: string,
  crewName: string,
  dayResult: DayComplianceResult,
  violations: ComplianceViolation[],
  detail: CrewDetail
): void {
  const longestChunk = Math.max(
    ...(dayResult.chunks ?? []).map((c: { start: number; end: number }) => c.end - c.start),
    0
  );
  violations.push({
    crewId,
    crewName,
    date: dayResult.date,
    rule: "split_rest",
    description: `Rest period split rule violated: ${dayResult.chunks.length} periods, longest ${longestChunk}h (must have ≤2 periods, one ≥6h)`,
    severity: "warning",
  });
  detail.warningCount++;
  detail.isCompliant = false;
}

function add7dViolation(
  crewId: string,
  crewName: string,
  rolling: RollingComplianceResult,
  violations: ComplianceViolation[],
  detail: CrewDetail
): void {
  const deficit = 77 - rolling.rest_7d;
  const severity: "warning" | "violation" = deficit >= 10 ? "violation" : "warning";

  violations.push({
    crewId,
    crewName,
    date: rolling.end_date,
    rule: "77h_7d",
    description: `Only ${rolling.rest_7d}h rest in 7-day period ending ${rolling.end_date} (minimum 77h required)`,
    severity,
    restHours: rolling.rest_7d,
    requiredHours: 77,
  });

  if (severity === "violation") {
    detail.violationCount++;
  } else {
    detail.warningCount++;
  }
  detail.isCompliant = false;
}

function processCrewCompliance(
  crewId: string,
  crewName: string,
  daysMap: Map<string, RestHourFlags>,
  violations: ComplianceViolation[],
  crewDetailsMap: Map<string, CrewDetail>
): void {
  crewDetailsMap.set(crewId, {
    crewId,
    crewName,
    isCompliant: true,
    violationCount: 0,
    warningCount: 0,
  });

  const sortedDates = Array.from(daysMap.keys()).sort((a, b) => a.localeCompare(b));
  if (sortedDates.length === 0) {
    return;
  }

  const startDate = new Date(sortedDates[0]);
  const endDate = new Date(sortedDates[sortedDates.length - 1]);
  const allDates = getDatesInRange(startDate, endDate);

  const restDays: RestDay[] = allDates.map((dateStr) => {
    const hours = daysMap.get(dateStr) || initializeRestHours();
    return convertToRestDay(dateStr, hours);
  });

  const complianceResult = checkMonthCompliance(restDays);
  const detail = crewDetailsMap.get(crewId)!;

  for (const dayResult of complianceResult.days) {
    if (!dayResult.day_ok) {
      if (dayResult.min_rest_24 < 10) {
        add24hViolation(crewId, crewName, dayResult, violations, detail);
      }
      if (!dayResult.split_ok) {
        addSplitViolation(crewId, crewName, dayResult, violations, detail);
      }
    }
  }

  for (const rolling of complianceResult.rolling7d) {
    if (!rolling.ok) {
      add7dViolation(crewId, crewName, rolling, violations, detail);
    }
  }
}

export async function previewScheduleCompliance(
  orgId: string,
  assignments: ScheduleAssignment[]
): Promise<PreviewComplianceResponse> {
  const violations: ComplianceViolation[] = [];
  const crewDetailsMap = new Map<string, CrewDetail>();

  const crewList = await dbCrewStorage.getCrew(orgId);
  const crewLookup = new Map(crewList.map((c) => [c.id, c.name]));

  const enrichedAssignments: ScheduleAssignment[] = assignments.map((a) => ({
    ...a,
    crewName: a.crewName || crewLookup.get(a.crewId) || "Unknown",
  }));

  const crewDaysMap = buildCrewRestDaysFromAssignments(enrichedAssignments);

  for (const [crewId, daysMap] of crewDaysMap) {
    const crewName = crewLookup.get(crewId) || "Unknown";
    processCrewCompliance(crewId, crewName, daysMap, violations, crewDetailsMap);
  }

  const crewDetails = Array.from(crewDetailsMap.values());
  const compliantCrew = crewDetails.filter((c) => c.isCompliant).length;
  const violationCount = violations.filter((v) => v.severity === "violation").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;

  return {
    isCompliant: violations.length === 0,
    violations,
    summary: {
      totalCrew: crewDetails.length,
      compliantCrew,
      violationCount,
      warningCount,
    },
    crewDetails,
  };
}
