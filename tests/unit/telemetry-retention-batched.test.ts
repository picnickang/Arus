/**
 * Batched telemetry retention — contract coverage for
 * server/db-utils/retention.ts#applyTelemetryRetention.
 *
 * Verifies (with db / tenant-context / partitioning service stubbed):
 *   1. Missing policy row keeps the legacy "create a policy first" result.
 *   2. Row deletes are keyed by the PK tuple (org_id, ts, id) — never
 *      ctid, which is unsafe through a partitioned parent — and loop
 *      until a short batch signals exhaustion of expired rows.
 *   3. The sweep fans out per org under withTenantContext (FORCE RLS
 *      makes unpinned deletes silently no-op in production).
 *   4. When the table is partitioned, expired partitions are dropped
 *      BEFORE any row delete (the fast path).
 *   5. The per-run batch cap bounds the job and reports `exhausted`.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

type Row = Record<string, unknown>;

// --- scripted db stub -------------------------------------------------------
const state = {
  policies: [] as Row[],
  orgs: [] as Row[],
  // One entry per execute() call: the rowCount to report.
  executeRowCounts: [] as number[],
  executeCalls: [] as string[],
};

let telemetryRetentionPoliciesTable: unknown;

function chainFor(table: unknown) {
  const isPolicies = table === telemetryRetentionPoliciesTable;
  const rows = isPolicies ? state.policies : state.orgs;
  return {
    where: () => Promise.resolve(state.policies),
    then: (resolve: (rows: Row[]) => unknown, reject?: (err: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

const fakeDb = {
  select: () => ({ from: (table: unknown) => chainFor(table) }),
  delete: jest.fn(() => ({ where: async () => ({ rowCount: 0 }) })),
  execute: jest.fn(async (query: unknown) => {
    // Capture a searchable form of the SQL for assertions: drizzle sql``
    // objects keep their literal chunks internally, so a JSON dump of the
    // query object contains every raw SQL fragment verbatim.
    state.executeCalls.push(typeof query === "string" ? query : JSON.stringify(query));
    const rowCount = state.executeRowCounts.shift() ?? 0;
    return { rowCount, rows: [] };
  }),
};

const tenantContextOrgs: string[] = [];
const isPartitionedMock = jest.fn(async () => false);
const dropExpiredMock = jest.fn(async (_cutoff: Date) => 0);

let applyTelemetryRetention: (typeof import("../../server/db-utils/retention"))["applyTelemetryRetention"];

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db", () => ({
    __esModule: true,
    db: fakeDb,
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
  jest.unstable_mockModule("../../server/services/telemetry-partitioning/index", () => ({
    __esModule: true,
    isEquipmentTelemetryPartitioned: isPartitionedMock,
    dropExpiredPartitions: dropExpiredMock,
  }));

  const schema = await import("@shared/schema.js");
  telemetryRetentionPoliciesTable = schema.telemetryRetentionPolicies;
  ({ applyTelemetryRetention } = await import("../../server/db-utils/retention"));
});

beforeEach(() => {
  state.policies = [{ id: 1, retentionDays: 30, rollupEnabled: true, compressionEnabled: false }];
  state.orgs = [{ id: "org-a" }, { id: "org-b" }];
  state.executeRowCounts = [];
  state.executeCalls = [];
  tenantContextOrgs.length = 0;
  isPartitionedMock.mockClear();
  isPartitionedMock.mockResolvedValue(false);
  dropExpiredMock.mockClear();
  dropExpiredMock.mockResolvedValue(0);
  delete process.env["TELEMETRY_RETENTION_BATCH_SIZE"];
  delete process.env["TELEMETRY_RETENTION_MAX_BATCHES"];
});

describe("applyTelemetryRetention", () => {
  it("keeps the legacy result when no policy row exists", async () => {
    state.policies = [];
    const result = await applyTelemetryRetention();
    expect(result.success).toBe(false);
    expect(result.message).toContain("Create a policy first");
    expect(fakeDb.execute).not.toHaveBeenCalled();
  });

  it("deletes by PK tuple in batches per org until a short batch", async () => {
    process.env["TELEMETRY_RETENTION_BATCH_SIZE"] = "1000";
    // org-a: full batch (1000) then short batch (400); org-b: immediately empty.
    state.executeRowCounts = [1000, 400, 0];

    const result = await applyTelemetryRetention();

    expect(result.success).toBe(true);
    expect(result.deletedRecords).toBe(1400);
    expect(result.exhausted).toBe(false);
    // Both orgs swept under a pinned tenant context (org-a twice, org-b once).
    expect(tenantContextOrgs).toEqual(["org-a", "org-a", "org-b"]);
    // PK-tuple keying, never ctid.
    for (const call of state.executeCalls) {
      expect(call).toContain("(org_id, ts, id) IN");
      expect(call).not.toContain("ctid");
    }
  });

  it("drops expired partitions before any row delete when partitioned", async () => {
    isPartitionedMock.mockResolvedValue(true);
    dropExpiredMock.mockResolvedValue(2);
    state.executeRowCounts = [0, 0];

    const result = await applyTelemetryRetention();

    expect(result.success).toBe(true);
    expect(result.partitionsDropped).toBe(2);
    expect(result.message).toContain("dropped 2 expired partitions");
    expect(dropExpiredMock).toHaveBeenCalledTimes(1);
    // The fast path ran before the first batched delete.
    expect(dropExpiredMock.mock.invocationCallOrder[0]).toBeLessThan(
      fakeDb.execute.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
    const cutoff = dropExpiredMock.mock.calls[0]?.[0] as Date;
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it("stops at the per-run batch cap and reports exhausted", async () => {
    process.env["TELEMETRY_RETENTION_BATCH_SIZE"] = "1000";
    process.env["TELEMETRY_RETENTION_MAX_BATCHES"] = "3";
    // Every batch comes back full — without the cap this would never stop.
    state.executeRowCounts = [1000, 1000, 1000, 1000, 1000];

    const result = await applyTelemetryRetention();

    expect(result.success).toBe(true);
    expect(result.deletedRecords).toBe(3000);
    expect(result.exhausted).toBe(true);
    expect(result.message).toContain("batch cap of 3 reached");
    expect(fakeDb.execute).toHaveBeenCalledTimes(3);
    // Cap consumed entirely by org-a; org-b is picked up by the next run.
    expect(new Set(tenantContextOrgs)).toEqual(new Set(["org-a"]));
  });
});
