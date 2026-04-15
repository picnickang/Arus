/**
 * STCW Compliance Checker — Unit Tests
 *
 * Tests the core rest-hour compliance calculations per MLC/STCW 2010.
 * These are regulatory-critical: a miscalculation = Port State Control deficiency.
 *
 * Rules tested:
 *   - Minimum 10 hours rest in any 24-hour period
 *   - Rest may be divided into no more than 2 periods
 *   - One rest period must be at least 6 hours long
 *   - Minimum 77 hours rest in any 7-day period
 */

import { describe, it, expect } from "@jest/globals";
import { checkMonthCompliance } from "../../server/stcw-compliance/compliance-checker";
import { chunksFromDay, restHoursInWindow, normalizeRestDays, countRestHours } from "../../server/stcw-compliance/rest-utils";
import type { RestDay } from "../../server/stcw-compliance/types";
import { STCW_MIN_REST_24, STCW_MIN_REST_7D } from "../../server/stcw-compliance/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a RestDay where 1=rest, 0=work for each hour 0-23 */
function makeDay(date: string, hours: number[]): RestDay {
  const day: RestDay = { date };
  for (let i = 0; i < 24; i++) {
    (day as any)[`h${i}`] = hours[i] ?? 0;
  }
  return day;
}

/** Standard watch pattern: 4-on/8-off (common for deck officers) */
function makeStandardWatchDay(date: string): RestDay {
  // 0000-0400 watch (work), 0400-1200 rest, 1200-1600 watch, 1600-2400 rest
  const hours = [0,0,0,0, 1,1,1,1,1,1,1,1, 0,0,0,0, 1,1,1,1,1,1,1,1];
  return makeDay(date, hours);
}

/** All rest day */
function makeFullRestDay(date: string): RestDay {
  return makeDay(date, Array(24).fill(1));
}

/** Overworked day: only 6 hours rest (below STCW minimum of 10) */
function makeOverworkedDay(date: string): RestDay {
  // Work 18 hours, rest 6 (0200-0800)
  const hours = [0,0, 1,1,1,1,1,1, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  return makeDay(date, hours);
}

/** Three-split day: rest split into 3 periods (violates STCW) */
function makeThreeSplitDay(date: string): RestDay {
  // Rest: 01-04, 09-12, 18-21 (3 periods — illegal even if total ≥ 10)
  const hours = [0, 1,1,1, 0,0,0,0,0, 1,1,1, 0,0,0,0,0,0, 1,1,1, 0,0,0];
  return makeDay(date, hours);
}

// ── rest-utils tests ─────────────────────────────────────────────────────────

describe("STCW rest-utils", () => {
  describe("chunksFromDay", () => {
    it("identifies a single continuous rest block", () => {
      const day = makeDay("2025-01-01", [0,0,0,0,0,0, 1,1,1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0]);
      const chunks = chunksFromDay(day);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ start: 6, end: 16 });
    });

    it("identifies two rest periods in a standard watch pattern", () => {
      const day = makeStandardWatchDay("2025-01-01");
      const chunks = chunksFromDay(day);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ start: 4, end: 12 });
      expect(chunks[1]).toEqual({ start: 16, end: 24 });
    });

    it("identifies three rest periods", () => {
      const day = makeThreeSplitDay("2025-01-01");
      const chunks = chunksFromDay(day);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });

    it("handles all-rest day", () => {
      const day = makeFullRestDay("2025-01-01");
      const chunks = chunksFromDay(day);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ start: 0, end: 24 });
    });

    it("handles all-work day (no rest)", () => {
      const day = makeDay("2025-01-01", Array(24).fill(0));
      const chunks = chunksFromDay(day);
      expect(chunks).toHaveLength(0);
    });
  });

  describe("countRestHours", () => {
    it("counts 16 rest hours in standard watch", () => {
      expect(countRestHours(makeStandardWatchDay("2025-01-01"))).toBe(16);
    });

    it("counts 24 for full rest day", () => {
      expect(countRestHours(makeFullRestDay("2025-01-01"))).toBe(24);
    });

    it("counts 0 for all-work day", () => {
      expect(countRestHours(makeDay("2025-01-01", Array(24).fill(0)))).toBe(0);
    });

    it("counts 6 for overworked day", () => {
      expect(countRestHours(makeOverworkedDay("2025-01-01"))).toBe(6);
    });
  });

  describe("normalizeRestDays", () => {
    it("converts raw rows with string values to numeric RestDay objects", () => {
      const raw = [{ date: "2025-01-01", h0: "1", h1: "0", h2: "1" }];
      const normalized = normalizeRestDays(raw);
      expect(normalized[0].h0).toBe(1);
      expect(normalized[0].h1).toBe(0);
      expect(normalized[0].h2).toBe(1);
    });

    it("defaults missing hours to 0", () => {
      const raw = [{ date: "2025-01-01" }];
      const normalized = normalizeRestDays(raw);
      for (let h = 0; h < 24; h++) {
        expect(normalized[0][`h${h}`]).toBe(0);
      }
    });
  });
});

// ── compliance-checker tests ─────────────────────────────────────────────────

describe("STCW checkMonthCompliance", () => {
  it("passes for a week of standard watch-keeping", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      makeStandardWatchDay(`2025-01-${String(i + 1).padStart(2, "0")}`)
    );
    const result = checkMonthCompliance(days);
    expect(result.days.every(d => d.rest_total)).toBe(true);
    expect(result.days.every(d => d.rest_total >= STCW_MIN_REST_24)).toBe(true);
    expect(result.days.every(d => d.split_ok)).toBe(true);
    const last7d = result.rolling7d[result.rolling7d.length - 1];
    expect(last7d.rest_7d).toBeGreaterThanOrEqual(STCW_MIN_REST_7D);
  });

  it("fails when daily rest drops below 10 hours", () => {
    const days = [makeOverworkedDay("2025-01-01")];
    const result = checkMonthCompliance(days);
    expect(result.days[0].rest_total).toBe(6);
    expect(result.days[0].day_ok).toBe(false);
    expect(result.ok).toBe(false);
  });

  it("fails when rest is split into 3 or more periods", () => {
    const day = makeThreeSplitDay("2025-01-01");
    const restTotal = countRestHours(day);
    // Even if total rest >= 10, three splits violates STCW
    const result = checkMonthCompliance([day]);
    expect(result.days[0].split_ok).toBe(false);
    expect(result.days[0].day_ok).toBe(false);
  });

  it("fails when 7-day rolling total is below 77 hours", () => {
    // 7 days of overworked (6h rest/day = 42h total, well below 77)
    const days = Array.from({ length: 7 }, (_, i) =>
      makeOverworkedDay(`2025-01-${String(i + 1).padStart(2, "0")}`)
    );
    const result = checkMonthCompliance(days);
    const last7d = result.rolling7d[result.rolling7d.length - 1];
    expect(last7d.rest_7d).toBeLessThan(STCW_MIN_REST_7D);
    expect(last7d.ok).toBe(false);
    expect(result.ok).toBe(false);
  });

  it("passes when 7-day rolling total meets 77 hours", () => {
    // 7 days of standard watch (16h rest/day = 112h, well above 77)
    const days = Array.from({ length: 7 }, (_, i) =>
      makeStandardWatchDay(`2025-01-${String(i + 1).padStart(2, "0")}`)
    );
    const result = checkMonthCompliance(days);
    const last7d = result.rolling7d[result.rolling7d.length - 1];
    expect(last7d.rest_7d).toBeGreaterThanOrEqual(STCW_MIN_REST_7D);
    expect(last7d.ok).toBe(true);
  });

  it("handles a full 31-day month", () => {
    const days = Array.from({ length: 31 }, (_, i) =>
      makeStandardWatchDay(`2025-01-${String(i + 1).padStart(2, "0")}`)
    );
    const result = checkMonthCompliance(days);
    expect(result.days).toHaveLength(31);
    expect(result.rolling7d).toHaveLength(31);
    expect(result.days.every(d => d.rest_total >= STCW_MIN_REST_24)).toBe(true);
    expect(result.days.every(d => d.split_ok)).toBe(true);
    const last7d = result.rolling7d[result.rolling7d.length - 1];
    expect(last7d.rest_7d).toBeGreaterThanOrEqual(STCW_MIN_REST_7D);
  });

  it("detects non-compliance in a mixed month", () => {
    // 5 normal days + 2 overworked days
    const days = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeStandardWatchDay(`2025-01-${String(i + 1).padStart(2, "0")}`)
      ),
      makeOverworkedDay("2025-01-06"),
      makeOverworkedDay("2025-01-07"),
    ];
    const result = checkMonthCompliance(days);
    expect(result.ok).toBe(false);
    expect(result.days[5].day_ok).toBe(false);
    expect(result.days[6].day_ok).toBe(false);
  });

  it("validates that STCW_MIN_REST_24 constant is 10", () => {
    expect(STCW_MIN_REST_24).toBe(10);
  });

  it("validates that STCW_MIN_REST_7D constant is 77", () => {
    expect(STCW_MIN_REST_7D).toBe(77);
  });

  it("handles empty day array", () => {
    const result = checkMonthCompliance([]);
    expect(result.ok).toBe(true);
    expect(result.days).toHaveLength(0);
    expect(result.rolling7d).toHaveLength(0);
  });
});
