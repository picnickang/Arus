/**
 * STCW Rest Utility Functions
 */

import type { RestDay, RestChunk } from "./types";

export function chunksFromDay(day: RestDay): RestChunk[] {
  const chunks: RestChunk[] = [];
  let currentStart: number | null = null;

  for (let h = 0; h < 24; h++) {
    const v = Number.parseInt(String(day[`h${h}` as keyof RestDay] || 0));

    if (v === 1 && currentStart === null) {
      currentStart = h;
    }

    if ((v === 0 || h === 23) && currentStart !== null) {
      const end = v === 0 ? h : 24;
      chunks.push({ start: currentStart, end });
      currentStart = null;
    }
  }

  return chunks;
}

export function restHoursInWindow(days: RestDay[], center: number): number {
  const hourlyData: number[] = [];
  for (const day of days) {
    for (let i = 0; i < 24; i++) {
      hourlyData.push(Number.parseInt(String(day[`h${i}` as keyof RestDay] || 0)));
    }
  }

  const start = Math.max(0, center - 24);
  const windowSlice = hourlyData.slice(start, center);
  return windowSlice.reduce((sum, val) => sum + val, 0);
}

export function normalizeRestDays(rows: Array<Record<string, unknown>>): RestDay[] {
  return rows.map((row) => {
    const normalized: RestDay = { date: String(row["date"] ?? "") };

    for (let i = 0; i < 24; i++) {
      const key = `h${i}` as keyof RestDay;
      normalized[key] = Number.parseInt(String(row[key] ?? row[String(i)] ?? 0)) || 0;
    }

    return normalized;
  });
}

export function countRestHours(day: RestDay): number {
  let rest = 0;
  for (let h = 0; h < 24; h++) {
    rest += Number.parseInt(String(day[`h${h}` as keyof RestDay] || 0));
  }
  return rest;
}

export function countWorkHours(day: RestDay): number {
  let work = 0;
  for (let h = 0; h < 24; h++) {
    const isRest = Number.parseInt(String(day[`h${h}` as keyof RestDay] || 0)) === 1;
    if (!isRest) {
      work++;
    }
  }
  return work;
}

export function findLongestRestBlock(day: RestDay): number {
  const chunks = chunksFromDay(day);
  if (chunks.length === 0) {
    return 0;
  }
  return Math.max(...chunks.map((c) => c.end - c.start));
}
