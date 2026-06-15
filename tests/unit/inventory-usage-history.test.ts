/**
 * #99 / B1 — inventory auto-optimization now derives usage history from real
 * recorded work-order consumption instead of `cryptoRandom`-simulated values.
 *
 * These pin the shared monthly-bucketing helper that both inventory storage
 * implementations (the real DB path and the typed adapter) delegate to, so the
 * production aggregation is verified without a database.
 */

import { describe, it, expect } from "@jest/globals";
import { bucketMonthlyUsage, usageWindowStart, type UsageRow } from "../../server/inventory/usage-history";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("usageWindowStart", () => {
  it("returns the first day of the oldest month bucket (UTC)", () => {
    // 12-month window ending June 2026 → starts July 2025.
    expect(usageWindowStart(12, NOW).toISOString()).toBe("2025-07-01T00:00:00.000Z");
  });

  it("clamps months into [1, 60]", () => {
    expect(usageWindowStart(0, NOW).toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(usageWindowStart(1000, NOW).toISOString()).toBe("2021-07-01T00:00:00.000Z");
  });
});

describe("bucketMonthlyUsage", () => {
  it("aggregates quantityUsed into oldest→newest monthly buckets", () => {
    const rows: UsageRow[] = [
      { quantityUsed: 3, usedAt: new Date("2025-07-05T00:00:00Z"), createdAt: null }, // idx 0
      { quantityUsed: 2, usedAt: null, createdAt: new Date("2026-05-20T00:00:00Z") }, // idx 10 (createdAt fallback)
      { quantityUsed: 5, usedAt: new Date("2026-06-10T00:00:00Z"), createdAt: null }, // idx 11
      { quantityUsed: 4, usedAt: new Date("2026-06-28T00:00:00Z"), createdAt: null }, // idx 11 (same month → sum)
    ];
    const buckets = bucketMonthlyUsage(rows, 12, NOW);
    expect(buckets).toHaveLength(12);
    expect(buckets).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 9]);
  });

  it("ignores rows outside the window, undated rows, and unparseable dates", () => {
    const rows: UsageRow[] = [
      { quantityUsed: 99, usedAt: new Date("2025-06-01T00:00:00Z"), createdAt: null }, // before window start
      { quantityUsed: 7, usedAt: null, createdAt: null }, // undated
      { quantityUsed: 8, usedAt: "not-a-date", createdAt: null }, // unparseable
      { quantityUsed: 1, usedAt: new Date("2026-06-02T00:00:00Z"), createdAt: null }, // idx 11
    ];
    const buckets = bucketMonthlyUsage(rows, 12, NOW);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(1);
    expect(buckets[11]).toBe(1);
  });

  it("treats a null quantityUsed as zero and parses ISO string dates", () => {
    const rows: UsageRow[] = [
      { quantityUsed: null, usedAt: "2026-06-09T00:00:00Z", createdAt: null },
    ];
    const buckets = bucketMonthlyUsage(rows, 3, NOW);
    expect(buckets).toEqual([0, 0, 0]);
  });

  it("returns an all-zero array for a part with no recorded consumption", () => {
    expect(bucketMonthlyUsage([], 6, NOW)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
