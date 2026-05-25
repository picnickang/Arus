/**
 * STCW Compliance Checker
 */

import type {
  RestDay,
  DayComplianceResult,
  RollingComplianceResult,
  MonthComplianceResult,
} from "./types";
import { STCW_MIN_REST_24, STCW_MIN_REST_7D } from "./types";
import { chunksFromDay, restHoursInWindow } from "./rest-utils";

export function checkMonthCompliance(days: RestDay[]): MonthComplianceResult {
  const results: DayComplianceResult[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    if (!day) continue;
    const chunks = chunksFromDay(day);

    const totalRest = (() => {
      let total = 0;
      for (let i = 0; i < 24; i++) {
        total += Number.parseInt(String(day[`h${i}` as keyof RestDay] || 0));
      }
      return total;
    })();

    const splitOk =
      chunks.length <= 2 &&
      (chunks.length === 0 || chunks.some((chunk) => chunk.end - chunk.start >= 6));

    let minRest24 = 999;
    for (let hh = dayIndex * 24 + 1; hh <= dayIndex * 24 + 24; hh++) {
      const restInWindow = restHoursInWindow(days, hh);
      if (restInWindow < minRest24) {
        minRest24 = restInWindow;
      }
    }

    const dayOk = minRest24 >= STCW_MIN_REST_24 && splitOk;

    results.push({
      date: day.date,
      rest_total: totalRest,
      min_rest_24: minRest24,
      chunks,
      split_ok: splitOk,
      day_ok: dayOk,
    });
  }

  const rolling7d: RollingComplianceResult[] = [];

  for (let i = 0; i < days.length; i++) {
    const blockStart = Math.max(0, i - 6);
    const block = days.slice(blockStart, i + 1);

    let totalRest7d = 0;
    for (const day of block) {
      for (let h = 0; h < 24; h++) {
        totalRest7d += Number.parseInt(String(day[`h${h}` as keyof RestDay] || 0));
      }
    }

    const endDay = days[i];
    if (!endDay) continue;
    rolling7d.push({
      end_date: endDay.date,
      rest_7d: totalRest7d,
      ok: totalRest7d >= STCW_MIN_REST_7D,
    });
  }

  const allDaysOk = results.every((r) => r.day_ok);
  const all7dOk = rolling7d.every((r) => r.ok);

  return {
    ok: allDaysOk && all7dOk,
    days: results,
    rolling7d,
  };
}
