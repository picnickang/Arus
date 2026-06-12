import type { DayRow, ShiftPattern } from "./restGridUtils";
import { DEFAULT_PATTERNS } from "./restGridUtils";

export function applyPatternToRows(
  rows: DayRow[],
  patternId: string,
  dayIndices: number[],
  customPatterns: ShiftPattern[] = []
): { rows: DayRow[]; appliedPattern: ShiftPattern | null } {
  const pattern = [...DEFAULT_PATTERNS, ...customPatterns].find((p) => p.id === patternId);
  if (!pattern) {
    return { rows, appliedPattern: null };
  }

  const next = rows.map((r, i) => {
    if (dayIndices.includes(i)) {
      const newRow: DayRow = { date: r.date } as DayRow;
      for (let h = 0; h < 24; h++) {
        (newRow as Record<string, number | string>)[`h${h}`] = pattern.pattern[h] ?? 0;
      }
      return newRow;
    }
    return r;
  });

  return { rows: next, appliedPattern: pattern };
}

export function getWeekdayIndices(rows: DayRow[]): number[] {
  return rows
    .map((r, i) => {
      const day = new Date(r.date).getDay();
      return day >= 1 && day <= 5 ? i : -1;
    })
    .filter((i) => i !== -1);
}

export function getWeekendIndices(rows: DayRow[]): number[] {
  return rows
    .map((r, i) => {
      const day = new Date(r.date).getDay();
      return day === 0 || day === 6 ? i : -1;
    })
    .filter((i) => i !== -1);
}

export function copyWeekData(rows: DayRow[], sourceWeek: number, targetWeeks: number[]): DayRow[] {
  const startIdx = sourceWeek * 7;
  const endIdx = Math.min(startIdx + 7, rows.length);
  const weekData = rows.slice(startIdx, endIdx);

  const next = [...rows];
  targetWeeks.forEach((weekNum) => {
    const targetStart = weekNum * 7;
    weekData.forEach((day, offset) => {
      const target = next[targetStart + offset];
      if (target) {
        next[targetStart + offset] = { ...day, date: target.date };
      }
    });
  });
  return next;
}

export function applyRestPeriodToAllDays(rows: DayRow[], pattern: number[]): DayRow[] {
  return rows.map((r) => {
    const newRow: DayRow = { date: r.date } as DayRow;
    for (let h = 0; h < 24; h++) {
      (newRow as Record<string, number | string>)[`h${h}`] = pattern[h] ?? 0;
    }
    return newRow;
  });
}

export function clearAllHours(rows: DayRow[]): DayRow[] {
  return rows.map((r) => {
    const x = { ...r } as DayRow;
    for (let h = 0; h < 24; h++) {
      (x as Record<string, number | string>)[`h${h}`] = 0;
    }
    return x;
  });
}
