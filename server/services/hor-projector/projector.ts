/**
 * HoR Projector - Core Projection Logic
 * 
 * Calculates projected rest hours from draft assignments without persisting.
 * Used for real-time compliance feedback during scheduling operations.
 */

import { checkMonthCompliance, calculateFatigueRisk } from "../../stcw-compliance";
import type { RestDay } from "../../stcw-compliance";
import type {
  DraftAssignment,
  ProjectedRestDay,
  CrewProjection,
  ProjectionResult,
  ProjectionViolation,
  RestHourFlags,
} from "./types";

export function initializeRestHours(): RestHourFlags {
  return {
    h0: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, h7: 1,
    h8: 1, h9: 1, h10: 1, h11: 1, h12: 1, h13: 1, h14: 1, h15: 1,
    h16: 1, h17: 1, h18: 1, h19: 1, h20: 1, h21: 1, h22: 1, h23: 1,
  };
}

export function markWorkHoursForDay(
  flags: RestHourFlags,
  workHours: number[]
): RestHourFlags {
  const result = { ...flags };
  for (const h of workHours) {
    if (h >= 0 && h <= 23) {
      const key = `h${h}` as keyof RestHourFlags;
      result[key] = 0;
    }
  }
  return result;
}

export function getWorkHoursForDate(
  start: Date,
  end: Date,
  targetDateStr: string
): number[] {
  const workHours: number[] = [];
  
  const targetDayStart = new Date(`${targetDateStr}T00:00:00`);
  const targetDayEnd = new Date(`${targetDateStr}T23:59:59.999`);
  
  const effectiveStart = start < targetDayStart ? targetDayStart : start;
  
  let effectiveEnd: Date;
  if (end > targetDayEnd) {
    effectiveEnd = new Date(`${targetDateStr}T23:59:59.999`);
  } else {
    effectiveEnd = end;
  }
  
  if (effectiveStart >= effectiveEnd) {
    return workHours;
  }
  
  const effectiveEndDate = new Date(targetDateStr);
  effectiveEndDate.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(effectiveEnd);
  endDateOnly.setHours(0, 0, 0, 0);
  
  if (effectiveEnd.getHours() === 0 && 
      effectiveEnd.getMinutes() === 0 && 
      effectiveEnd.getSeconds() === 0 &&
      endDateOnly.getTime() > effectiveEndDate.getTime()) {
    return workHours;
  }

  const startHour = effectiveStart.getHours();
  
  let lastWorkHour: number;
  if (effectiveEnd.getTime() > targetDayEnd.getTime() || 
      (effectiveEnd.getHours() === 23 && effectiveEnd.getMinutes() >= 59)) {
    lastWorkHour = 23;
  } else {
    const endHour = effectiveEnd.getHours();
    const endMinutes = effectiveEnd.getMinutes();
    const endSeconds = effectiveEnd.getSeconds();
    
    if (endMinutes === 0 && endSeconds === 0) {
      lastWorkHour = endHour - 1;
    } else {
      lastWorkHour = endHour;
    }
  }

  for (let h = startHour; h <= lastWorkHour; h++) {
    if (h >= 0 && h <= 23) {
      workHours.push(h);
    }
  }

  return workHours;
}

export function getDatesInRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function countRestHours(flags: RestHourFlags): number {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    const key = `h${i}` as keyof RestHourFlags;
    if (flags[key] === 1) {count++;}
  }
  return count;
}

function countWorkHours(flags: RestHourFlags): number {
  return 24 - countRestHours(flags);
}

function deepCopyCrewDaysMap(
  source: Map<string, Map<string, RestHourFlags>>
): Map<string, Map<string, RestHourFlags>> {
  const copy = new Map<string, Map<string, RestHourFlags>>();
  for (const [crewId, daysMap] of source) {
    const daysCopy = new Map<string, RestHourFlags>();
    for (const [date, flags] of daysMap) {
      daysCopy.set(date, { ...flags });
    }
    copy.set(crewId, daysCopy);
  }
  return copy;
}

export function projectRestHoursFromAssignments(
  assignments: DraftAssignment[],
  existingRestDays?: Map<string, Map<string, RestHourFlags>>
): Map<string, Map<string, RestHourFlags>> {
  const crewDaysMap = existingRestDays 
    ? deepCopyCrewDaysMap(existingRestDays) 
    : new Map<string, Map<string, RestHourFlags>>();

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

function convertToProjectedRestDays(
  crewId: string,
  daysMap: Map<string, RestHourFlags>
): ProjectedRestDay[] {
  const days: ProjectedRestDay[] = [];
  
  const sortedDates = Array.from(daysMap.keys()).sort();
  
  for (const date of sortedDates) {
    const flags = daysMap.get(date)!;
    const restHours = countRestHours(flags);
    const workHours = countWorkHours(flags);
    
    days.push({
      date,
      crewId,
      workHours,
      restHours,
      isProjected: true,
      ...flags,
    });
  }
  
  return days;
}

function convertToRestDays(days: ProjectedRestDay[]): RestDay[] {
  return days.map((d) => ({
    date: d.date,
    h0: d.h0, h1: d.h1, h2: d.h2, h3: d.h3,
    h4: d.h4, h5: d.h5, h6: d.h6, h7: d.h7,
    h8: d.h8, h9: d.h9, h10: d.h10, h11: d.h11,
    h12: d.h12, h13: d.h13, h14: d.h14, h15: d.h15,
    h16: d.h16, h17: d.h17, h18: d.h18, h19: d.h19,
    h20: d.h20, h21: d.h21, h22: d.h22, h23: d.h23,
  }));
}

function extractViolations(
  crewId: string,
  crewName: string,
  days: ProjectedRestDay[],
  compliance: ReturnType<typeof checkMonthCompliance>
): ProjectionViolation[] {
  const violations: ProjectionViolation[] = [];

  for (const dayResult of compliance.days) {
    if (!dayResult.day_ok) {
      if (dayResult.min_rest_24 < 10) {
        violations.push({
          crewId,
          crewName,
          date: dayResult.date,
          rule: "10h_24h",
          severity: "error",
          description: `Only ${dayResult.min_rest_24}h rest in 24h period (min: 10h)`,
          currentValue: dayResult.min_rest_24,
          threshold: 10,
        });
      }
      if (!dayResult.split_ok) {
        violations.push({
          crewId,
          crewName,
          date: dayResult.date,
          rule: "split_rest",
          severity: "error",
          description: `Rest period split into more than 2 periods or longest block < 6h`,
        });
      }
    }
  }

  for (const rolling of compliance.rolling7d) {
    if (!rolling.ok) {
      violations.push({
        crewId,
        crewName,
        date: rolling.end_date,
        rule: "77h_7d",
        severity: "error",
        description: `Only ${rolling.rest_7d}h rest in 7 days (min: 77h)`,
        currentValue: rolling.rest_7d,
        threshold: 77,
      });
    }
  }

  return violations;
}

function calculateWeeklyWorkHours(days: ProjectedRestDay[], endDate: string): number {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startStr = start.toISOString().split("T")[0];

  let totalWork = 0;
  for (const day of days) {
    if (day.date >= startStr && day.date <= endDate) {
      totalWork += day.workHours;
    }
  }
  return totalWork;
}

function calculateLast24hRest(days: ProjectedRestDay[], targetDate: string): number {
  const targetDay = days.find((d) => d.date === targetDate);
  if (!targetDay) {return 24;}
  return targetDay.restHours;
}

export function projectComplianceFromAssignments(
  assignments: DraftAssignment[],
  crewLookup?: Map<string, { name: string; rank?: string }>,
  existingRestDays?: Map<string, Map<string, RestHourFlags>>
): ProjectionResult {
  const crewDaysMap = projectRestHoursFromAssignments(assignments, existingRestDays);
  
  const crewProjections: CrewProjection[] = [];
  const allViolations: ProjectionViolation[] = [];
  
  for (const [crewId, daysMap] of crewDaysMap) {
    const crewInfo = crewLookup?.get(crewId);
    const crewName = crewInfo?.name || "Unknown";
    
    const projectedDays = convertToProjectedRestDays(crewId, daysMap);
    const restDays = convertToRestDays(projectedDays);
    const compliance = checkMonthCompliance(restDays);
    
    const violations = extractViolations(crewId, crewName, projectedDays, compliance);
    allViolations.push(...violations);
    
    const latestDate = projectedDays.length > 0 
      ? projectedDays[projectedDays.length - 1].date 
      : new Date().toISOString().split("T")[0];
    
    const weeklyWorkHours = calculateWeeklyWorkHours(projectedDays, latestDate);
    const last24hRestHours = calculateLast24hRest(projectedDays, latestDate);

    let fatigue: CrewProjection["fatigue"];
    try {
      fatigue = calculateFatigueRisk(crewId, restDays);
      fatigue.crewName = crewName;
    } catch {
      fatigue = undefined;
    }
    
    crewProjections.push({
      crewId,
      crewName,
      days: projectedDays,
      compliance,
      fatigue,
      violations,
      weeklyWorkHours,
      last24hRestHours,
    });
  }
  
  const compliantCrew = crewProjections.filter((p) => p.violations.length === 0).length;
  const warningCount = allViolations.filter((v) => v.severity === "warning").length;
  const errorCount = allViolations.filter((v) => v.severity === "error").length;
  
  return {
    isCompliant: errorCount === 0,
    crewProjections,
    violations: allViolations,
    summary: {
      totalCrew: crewProjections.length,
      compliantCrew,
      warningCount,
      errorCount,
    },
  };
}

export function mergeExistingRestWithProjected(
  existingDays: RestDay[],
  crewId: string
): Map<string, RestHourFlags> {
  const daysMap = new Map<string, RestHourFlags>();
  
  for (const day of existingDays) {
    daysMap.set(day.date, {
      h0: day.h0 ?? 1, h1: day.h1 ?? 1, h2: day.h2 ?? 1, h3: day.h3 ?? 1,
      h4: day.h4 ?? 1, h5: day.h5 ?? 1, h6: day.h6 ?? 1, h7: day.h7 ?? 1,
      h8: day.h8 ?? 1, h9: day.h9 ?? 1, h10: day.h10 ?? 1, h11: day.h11 ?? 1,
      h12: day.h12 ?? 1, h13: day.h13 ?? 1, h14: day.h14 ?? 1, h15: day.h15 ?? 1,
      h16: day.h16 ?? 1, h17: day.h17 ?? 1, h18: day.h18 ?? 1, h19: day.h19 ?? 1,
      h20: day.h20 ?? 1, h21: day.h21 ?? 1, h22: day.h22 ?? 1, h23: day.h23 ?? 1,
    });
  }
  
  return daysMap;
}
