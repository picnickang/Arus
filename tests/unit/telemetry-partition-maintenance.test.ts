/**
 * Telemetry partition maintenance — pure month/bound math.
 *
 * Covers the helpers the daily partition job and the retention fast
 * path rely on: partition naming, UTC month arithmetic across year
 * rollovers, relpartbound parsing, and expired-partition selection
 * (which must never select the DEFAULT partition).
 */

import { jest, describe, it, expect, beforeAll } from "@jest/globals";

let svc: typeof import("../../server/services/telemetry-partitioning/index");

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db", () => ({
    __esModule: true,
    db: { execute: jest.fn(), transaction: jest.fn() },
    pool: null,
    libsqlClient: null,
    isLocalMode: false,
    deploymentMode: "CLOUD",
  }));
  svc = await import("../../server/services/telemetry-partitioning/index");
});

describe("partitionNameForMonth / month math", () => {
  it("names partitions equipment_telemetry_yYYYYmMM", () => {
    expect(svc.partitionNameForMonth(new Date(Date.UTC(2026, 5, 1)))).toBe(
      "equipment_telemetry_y2026m06"
    );
    expect(svc.partitionNameForMonth(new Date(Date.UTC(2026, 0, 1)))).toBe(
      "equipment_telemetry_y2026m01"
    );
  });

  it("monthStartUTC truncates to the first of the month in UTC", () => {
    const d = new Date(Date.UTC(2026, 5, 17, 23, 59, 59));
    expect(svc.monthStartUTC(d).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("addMonthsUTC rolls over year boundaries", () => {
    const dec = new Date(Date.UTC(2026, 11, 1));
    expect(svc.addMonthsUTC(dec, 1).toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(svc.addMonthsUTC(dec, 3).toISOString()).toBe("2027-03-01T00:00:00.000Z");
    expect(svc.partitionNameForMonth(svc.addMonthsUTC(dec, 1))).toBe(
      "equipment_telemetry_y2027m01"
    );
  });
});

describe("parsePartitionUpperBound", () => {
  it("extracts the exclusive upper bound from a RANGE bound expression", () => {
    const bound = "FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00')";
    expect(svc.parsePartitionUpperBound(bound)?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("returns null for the DEFAULT partition and for garbage", () => {
    expect(svc.parsePartitionUpperBound("DEFAULT")).toBeNull();
    expect(svc.parsePartitionUpperBound("  default ")).toBeNull();
    expect(svc.parsePartitionUpperBound("FOR VALUES FROM ('x') TO ('not-a-date')")).toBeNull();
    expect(svc.parsePartitionUpperBound("")).toBeNull();
  });
});

describe("selectExpiredPartitions", () => {
  const partitions = [
    {
      name: "equipment_telemetry_y2026m01",
      upperBound: new Date(Date.UTC(2026, 1, 1)),
      isDefault: false,
    },
    {
      name: "equipment_telemetry_y2026m02",
      upperBound: new Date(Date.UTC(2026, 2, 1)),
      isDefault: false,
    },
    { name: "equipment_telemetry_default", upperBound: null, isDefault: true },
  ];

  it("selects only partitions whose entire range is older than the cutoff", () => {
    // Cutoff mid-February: January (upper bound Feb 1) is wholly expired,
    // February (upper bound Mar 1) still holds in-window rows.
    const cutoff = new Date(Date.UTC(2026, 1, 15));
    const expired = svc.selectExpiredPartitions(partitions, cutoff);
    expect(expired.map((p) => p.name)).toEqual(["equipment_telemetry_y2026m01"]);
  });

  it("treats upper bound == cutoff as expired (bound is exclusive)", () => {
    const cutoff = new Date(Date.UTC(2026, 2, 1));
    const expired = svc.selectExpiredPartitions(partitions, cutoff);
    expect(expired.map((p) => p.name)).toEqual([
      "equipment_telemetry_y2026m01",
      "equipment_telemetry_y2026m02",
    ]);
  });

  it("never selects the DEFAULT partition, even with a far-future cutoff", () => {
    const cutoff = new Date(Date.UTC(2100, 0, 1));
    const expired = svc.selectExpiredPartitions(partitions, cutoff);
    expect(expired.some((p) => p.isDefault)).toBe(false);
    expect(expired).toHaveLength(2);
  });
});
