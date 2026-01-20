import type { DayRow } from "./restGridUtils";
import { sum24, minRest24Around, splitOK, chunks } from "./restGridUtils";

export interface DayCompliance {
  date: string;
  restTotal: number;
  minRest24: number;
  splitOK: boolean;
  dayOK: boolean;
}

export interface STCWSummaryStats {
  compliantDays: number;
  totalDays: number;
  complianceRate: string;
  violations: number;
  avgRest: string;
  totalRest: number;
  longestWork: number;
  criticalViolations: number;
}

export const STCW_RULES = {
  MIN_REST_24H: 10,
  MIN_REST_7D: 77,
  MAX_REST_BLOCKS: 2,
  MIN_BLOCK_HOURS: 6,
  CRITICAL_REST_THRESHOLD: 8,
  NIGHT_START: 20,
  NIGHT_END: 6,
} as const;

export function calculateDayCompliance(rows: DayRow[]): DayCompliance[] {
  return rows.map((r, i) => ({
    date: r.date,
    restTotal: sum24(r),
    minRest24: minRest24Around(i, rows),
    splitOK: splitOK(r),
    dayOK: minRest24Around(i, rows) >= STCW_RULES.MIN_REST_24H && splitOK(r),
  }));
}

export function calculateSummaryStats(rows: DayRow[], compliance: DayCompliance[]): STCWSummaryStats {
  const compliantDays = compliance.filter((c) => c.dayOK).length;
  const totalDays = rows.length;
  const violations = compliance.filter((c) => !c.dayOK);
  const avgRest = compliance.reduce((sum, c) => sum + c.restTotal, 0) / totalDays;
  const totalRest = compliance.reduce((sum, c) => sum + c.restTotal, 0);

  let longestWork = 0;
  rows.forEach((r) => {
    const workChunks = chunks(r).filter(([a, b]) => {
      const hours = Array.from({ length: b - a }, (_, i) => (r as Record<string, number | string | undefined>)[`h${a + i}`]);
      return hours.some((h) => h === 0);
    });
    workChunks.forEach(([a, b]) => {
      if (b - a > longestWork) { longestWork = b - a; }
    });
  });

  return {
    compliantDays,
    totalDays,
    complianceRate: ((compliantDays / totalDays) * 100).toFixed(1),
    violations: violations.length,
    avgRest: avgRest.toFixed(1),
    totalRest,
    longestWork,
    criticalViolations: violations.filter((v) => v.minRest24 < STCW_RULES.CRITICAL_REST_THRESHOLD).length,
  };
}

export function timeToHourPattern(startTime: string, endTime: string): number[] {
  const pattern = new Array(24).fill(0);
  if (!startTime || !endTime) { return pattern; }

  const [startHour] = startTime.split(":").map(Number);
  const [endHour] = endTime.split(":").map(Number);

  if (endHour <= startHour) {
    for (let h = startHour; h < 24; h++) {pattern[h] = 1;}
    for (let h = 0; h < endHour; h++) {pattern[h] = 1;}
  } else {
    for (let h = startHour; h < endHour; h++) {pattern[h] = 1;}
  }
  return pattern;
}

export function isNightHour(hour: number): boolean {
  return hour >= STCW_RULES.NIGHT_START || hour < STCW_RULES.NIGHT_END;
}

export function getSevenDayRestTotal(dayIndex: number, rows: DayRow[]): number {
  let total = 0;
  const startIdx = Math.max(0, dayIndex - 6);
  for (let i = startIdx; i <= dayIndex; i++) {
    total += sum24(rows[i]);
  }
  return total;
}

export function check7DayCompliance(dayIndex: number, rows: DayRow[]): boolean {
  if (dayIndex < 6) { return true; }
  return getSevenDayRestTotal(dayIndex, rows) >= STCW_RULES.MIN_REST_7D;
}
