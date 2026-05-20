/**
 * Telemetry Warehouse Export — date math.
 *
 * `previousUtcDate` derives the UTC midnight + ISO date string for "yesterday"
 * relative to `now`. Because the warehouse partition key is the UTC date,
 * the math has to ignore local-time / DST entirely.
 *
 * `computeRetentionCutoffDate` is a pure helper used by the retention sweep:
 * partitions strictly older than this YYYY-MM-DD are eligible for deletion.
 */

import { describe, it, expect } from "@jest/globals";

import { previousUtcDate } from "../../server/services/telemetry-warehouse-export/date-utils";
import { computeRetentionCutoffDate } from "../../server/services/telemetry-warehouse-export/retention";

describe("previousUtcDate", () => {
  it("returns the prior UTC date for a mid-day timestamp", () => {
    const { dateStr, dayStart } = previousUtcDate(new Date("2026-05-20T13:45:12.000Z"));
    expect(dateStr).toBe("2026-05-19");
    expect(dayStart.toISOString()).toBe("2026-05-19T00:00:00.000Z");
  });

  it("treats UTC midnight itself as belonging to the new day (yesterday = previous day)", () => {
    const { dateStr, dayStart } = previousUtcDate(new Date("2026-05-20T00:00:00.000Z"));
    expect(dateStr).toBe("2026-05-19");
    expect(dayStart.toISOString()).toBe("2026-05-19T00:00:00.000Z");
  });

  it("rolls back across a UTC month boundary", () => {
    const { dateStr, dayStart } = previousUtcDate(new Date("2026-06-01T01:00:00.000Z"));
    expect(dateStr).toBe("2026-05-31");
    expect(dayStart.toISOString()).toBe("2026-05-31T00:00:00.000Z");
  });

  it("rolls back across a UTC year boundary", () => {
    const { dateStr, dayStart } = previousUtcDate(new Date("2026-01-01T00:30:00.000Z"));
    expect(dateStr).toBe("2025-12-31");
    expect(dayStart.toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });

  it("is unaffected by US spring-forward DST (Mar 8 2026, 07:00 UTC)", () => {
    // Local-time DST should not shift the UTC date math at all.
    const { dateStr } = previousUtcDate(new Date("2026-03-08T07:30:00.000Z"));
    expect(dateStr).toBe("2026-03-07");
  });

  it("is unaffected by US fall-back DST (Nov 1 2026, 06:00 UTC)", () => {
    const { dateStr } = previousUtcDate(new Date("2026-11-01T06:30:00.000Z"));
    expect(dateStr).toBe("2026-10-31");
  });

  it("handles a leap-day boundary correctly", () => {
    const { dateStr } = previousUtcDate(new Date("2024-03-01T00:00:00.000Z"));
    expect(dateStr).toBe("2024-02-29");
  });
});

describe("computeRetentionCutoffDate", () => {
  it("subtracts the retention window in whole UTC days", () => {
    const cutoff = computeRetentionCutoffDate(new Date("2026-05-20T12:00:00.000Z"), 7);
    expect(cutoff).toBe("2026-05-13");
  });

  it("returns the same UTC date for retentionDays=0", () => {
    const cutoff = computeRetentionCutoffDate(new Date("2026-05-20T23:59:59.999Z"), 0);
    expect(cutoff).toBe("2026-05-20");
  });

  it("rolls back across a month boundary", () => {
    const cutoff = computeRetentionCutoffDate(new Date("2026-06-02T00:00:00.000Z"), 5);
    expect(cutoff).toBe("2026-05-28");
  });

  it("rolls back across a year boundary", () => {
    const cutoff = computeRetentionCutoffDate(new Date("2026-01-02T00:00:00.000Z"), 30);
    expect(cutoff).toBe("2025-12-03");
  });

  it("ignores DST — purely UTC subtraction", () => {
    // 7-day window straddling US fall-back DST (Nov 1 2026).
    const cutoff = computeRetentionCutoffDate(new Date("2026-11-05T12:00:00.000Z"), 7);
    expect(cutoff).toBe("2026-10-29");
  });

  it("handles a leap-year window", () => {
    const cutoff = computeRetentionCutoffDate(new Date("2024-03-05T00:00:00.000Z"), 7);
    expect(cutoff).toBe("2024-02-27");
  });
});
