import { dbSchedulerStorage, dbStcwStorage, dbCrewStorage } from "../repositories";
import type { InsertCrewRestSheet } from "@shared/schema";

interface HoRGenerationResult {
  success: boolean;
  schedulerRunId: string;
  sheetsCreated: number;
  daysCreated: number;
  errors: string[];
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

export function initializeRestHours(): RestHourFlags {
  return {
    h0: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
    h7: 1,
    h8: 1,
    h9: 1,
    h10: 1,
    h11: 1,
    h12: 1,
    h13: 1,
    h14: 1,
    h15: 1,
    h16: 1,
    h17: 1,
    h18: 1,
    h19: 1,
    h20: 1,
    h21: 1,
    h22: 1,
    h23: 1,
  };
}

export function markWorkHoursForDay(flags: RestHourFlags, workHours: number[]): RestHourFlags {
  const result = { ...flags };
  for (const h of workHours) {
    if (h >= 0 && h <= 23) {
      const key = `h${h}` as keyof RestHourFlags;
      result[key] = 0;
    }
  }
  return result;
}

export function getWorkHoursForDate(start: Date, end: Date, targetDateStr: string): number[] {
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

  if (
    effectiveEnd.getHours() === 0 &&
    effectiveEnd.getMinutes() === 0 &&
    effectiveEnd.getSeconds() === 0 &&
    endDateOnly.getTime() > effectiveEndDate.getTime()
  ) {
    return workHours;
  }

  const startHour = effectiveStart.getHours();

  let lastWorkHour: number;
  if (
    effectiveEnd.getTime() > targetDayEnd.getTime() ||
    (effectiveEnd.getHours() === 23 && effectiveEnd.getMinutes() >= 59)
  ) {
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
    const iso = current.toISOString().split("T")[0];
    if (iso) {dates.push(iso);}
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getMonthName(month: number): string {
  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  return months[month] ?? "";
}

export async function generateHoRFromSchedule(
  schedulerRunId: string
): Promise<HoRGenerationResult> {
  const result: HoRGenerationResult = {
    success: false,
    schedulerRunId,
    sheetsCreated: 0,
    daysCreated: 0,
    errors: [],
  };

  try {
    const run = await dbSchedulerStorage.getSchedulerRun(schedulerRunId);
    if (!run) {
      result.errors.push(`Scheduler run ${schedulerRunId} not found`);
      return result;
    }

    if (run.status !== "published") {
      result.errors.push(`Scheduler run must be published (current: ${run.status})`);
      return result;
    }

    if (run.horGenerated) {
      result.errors.push(`HoR already generated for this run`);
      return result;
    }

    const assignments = await dbSchedulerStorage.getScheduleAssignmentsByRun(schedulerRunId);

    if (assignments.length === 0) {
      result.errors.push("No schedule assignments found for this run");
      return result;
    }

    const crewMap = await buildCrewLookup(run.orgId);

    type CrewMonthData = {
      crewId: string;
      crewName: string;
      rank: string | null;
      year: number;
      month: string;
      days: Map<string, RestHourFlags>;
      vesselId: string | null;
    };
    const sheetDataMap = new Map<string, CrewMonthData>();

    for (const assignment of assignments) {
      const startTime = new Date(assignment.start);
      const endTime = new Date(assignment.end);

      const datesAffected = getDatesInRange(startTime, endTime);

      for (const dateStr of datesAffected) {
        const [yearStr = "0", monthStr = "1"] = dateStr.split("-");
        const year = Number.parseInt(yearStr);
        const monthNum = Number.parseInt(monthStr) - 1;
        const monthName = getMonthName(monthNum);

        const key = `${assignment.crewId}_${year}_${monthName}`;

        if (!sheetDataMap.has(key)) {
          const crewInfo = crewMap.get(assignment.crewId);
          sheetDataMap.set(key, {
            crewId: assignment.crewId,
            crewName: crewInfo?.name || "Unknown",
            rank: crewInfo?.rank || null,
            year,
            month: monthName,
            days: new Map(),
            vesselId: assignment.vesselId,
          });
        }

        const sheetData = sheetDataMap.get(key)!;

        if (!sheetData.days.has(dateStr)) {
          sheetData.days.set(dateStr, initializeRestHours());
        }

        const workHours = getWorkHoursForDate(startTime, endTime, dateStr);

        const currentFlags = sheetData.days.get(dateStr)!;
        sheetData.days.set(dateStr, markWorkHoursForDay(currentFlags, workHours));
      }
    }

    for (const [_key, sheetData] of sheetDataMap) {
      try {
        const sheetInsert: InsertCrewRestSheet = {
          orgId: run.orgId,
          vesselId: sheetData.vesselId,
          crewId: sheetData.crewId,
          crewName: sheetData.crewName,
          rank: sheetData.rank,
          month: sheetData.month,
          year: sheetData.year,
          sourceType: "schedule",
          scheduleRunId: schedulerRunId,
        };

        const sheet = await dbStcwStorage.createCrewRestSheet(sheetInsert);
        result.sheetsCreated++;

        for (const [date, hours] of sheetData.days) {
          try {
            await dbStcwStorage.upsertCrewRestDay(sheet.id, {
              orgId: run.orgId,
              date,
              ...hours,
            });
            result.daysCreated++;
          } catch (dayError) {
            result.errors.push(`Failed to create rest day for ${date}: ${dayError}`);
          }
        }
      } catch (sheetError) {
        result.errors.push(`Failed to create sheet for crew ${sheetData.crewId}: ${sheetError}`);
      }
    }

    await dbSchedulerStorage.markSchedulerRunHorGenerated(schedulerRunId);

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`HoR generation failed: ${error}`);
    return result;
  }
}

async function buildCrewLookup(
  orgId: string
): Promise<Map<string, { name: string; rank: string | null }>> {
  const crewMembers = await dbCrewStorage.getCrew(orgId);
  const lookup = new Map<string, { name: string; rank: string | null }>();
  for (const c of crewMembers) {
    lookup.set(c.id, { name: c.name, rank: c.rank });
  }
  return lookup;
}
