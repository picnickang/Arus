/**
 * Hourly telemetry rollup processor — orchestration contract.
 *
 * With the aggregator, db, and tenant context stubbed, verifies:
 *   1. The aggregation table is ensured exactly once per sweep.
 *   2. Orgs are enumerated from `organizations` and each org's
 *      aggregation runs under withTenantContext (raw_telemetry has
 *      FORCE RLS — an unpinned read returns zero rows in production).
 *   3. One org's failure is recorded but never aborts the sweep.
 *   4. Old fine-grained buckets are pruned once, after the fan-out.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

const ensureTableMock = jest.fn(async () => undefined);
const runScheduledMock = jest.fn(async (orgId: string, _lookback?: number) => {
  if (orgId === "org-broken") {
    throw new Error("aggregation exploded");
  }
  return {
    minute: { bucketsCreated: 3 },
    hour: { bucketsCreated: 2 },
    day: { bucketsCreated: 1 },
  };
});
const cleanupMock = jest.fn(async () => ({ minuteDeleted: 7, hourDeleted: 4 }));

const tenantContextOrgs: string[] = [];

let processTelemetryRollup: (typeof import("../../server/job-processors/telemetry-rollup-processor"))["processTelemetryRollup"];

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db", () => ({
    __esModule: true,
    db: {
      select: () => ({
        from: () => Promise.resolve([{ id: "org-ok" }, { id: "org-broken" }]),
      }),
    },
    pool: null,
    libsqlClient: null,
    isLocalMode: false,
    deploymentMode: "CLOUD",
  }));
  jest.unstable_mockModule("../../server/middleware/db-context", () => ({
    __esModule: true,
    withTenantContext: jest.fn(async (orgId: string, fn: () => Promise<unknown>) => {
      tenantContextOrgs.push(orgId);
      return fn();
    }),
  }));
  jest.unstable_mockModule(
    "../../server/services/telemetry-aggregation/telemetry-aggregator",
    () => ({
      __esModule: true,
      TelemetryAggregator: class {
        ensureTable = ensureTableMock;
        runScheduledAggregation = runScheduledMock;
        cleanupOldAggregations = cleanupMock;
      },
    })
  );

  ({ processTelemetryRollup } = await import(
    "../../server/job-processors/telemetry-rollup-processor"
  ));
});

beforeEach(() => {
  ensureTableMock.mockClear();
  runScheduledMock.mockClear();
  cleanupMock.mockClear();
  tenantContextOrgs.length = 0;
});

describe("processTelemetryRollup", () => {
  it("fans out per org under tenant context and isolates failures", async () => {
    const summary = await processTelemetryRollup();

    expect(ensureTableMock).toHaveBeenCalledTimes(1);
    expect(tenantContextOrgs).toEqual(["org-ok", "org-broken"]);
    expect(runScheduledMock).toHaveBeenCalledWith("org-ok", 2);
    expect(runScheduledMock).toHaveBeenCalledWith("org-broken", 2);

    expect(summary.orgsTotal).toBe(2);
    expect(summary.orgsSucceeded).toBe(1);
    expect(summary.orgsFailed).toBe(1);
    expect(summary.failures).toEqual([{ orgId: "org-broken", error: "aggregation exploded" }]);
    // 3 + 2 + 1 from the one successful org.
    expect(summary.bucketsCreated).toBe(6);

    // Cleanup runs exactly once, after the per-org fan-out.
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(summary.minuteDeleted).toBe(7);
    expect(summary.hourDeleted).toBe(4);
    expect(cleanupMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      runScheduledMock.mock.invocationCallOrder.at(-1) ?? 0
    );
  });

  it("honors orgIds and lookbackHours overrides for ad-hoc back-fills", async () => {
    const summary = await processTelemetryRollup({ orgIds: ["org-ok"], lookbackHours: 6 });

    expect(tenantContextOrgs).toEqual(["org-ok"]);
    expect(runScheduledMock).toHaveBeenCalledTimes(1);
    expect(runScheduledMock).toHaveBeenCalledWith("org-ok", 6);
    expect(summary.orgsTotal).toBe(1);
    expect(summary.orgsFailed).toBe(0);
  });
});
