/**
 * Offline conflict-resolution service — Phase 1 (work orders).
 *
 * These tests pin the contract of `server/conflict-resolution-service.ts`
 * without a live database by mocking only `../../server/db`. Drizzle's
 * operators (`eq`/`and`/`inArray`) and the work-order Zod schema are the
 * REAL implementations, so the WHERE clauses we capture are genuine SQL
 * objects we can scan for the org-scoping parameter.
 *
 * Covered behaviours:
 *   - allowlist: only enabled tables participate; others are refused.
 *   - payload validation: malformed client data is rejected.
 *   - clean apply: a matching base version applies and bumps version.
 *   - conflict: a stale base version is rejected and persisted, with the
 *     safety-critical flag derived from the changed fields.
 *   - not-found: a record outside the caller's scope is reported missing.
 *   - org scoping: every conflict read/resolve query carries the
 *     authenticated org id, and a non-matching scope resolves nothing.
 */

import { describe, it, expect, jest, beforeAll, beforeEach } from "@jest/globals";

import { workOrders, syncConflicts } from "@shared/schema-runtime";

const ORG_A = "org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// ── Scenario the fake db resolves against (reset per test) ──────────────
interface Scenario {
  guardedUpdate: unknown[];
  currentWorkOrder: unknown[];
  insertedConflict: unknown[];
  selectConflicts: unknown[];
  updateConflict: unknown[];
}

const scenario: Scenario = {
  guardedUpdate: [],
  currentWorkOrder: [],
  insertedConflict: [],
  selectConflicts: [],
  updateConflict: [],
};

interface CapturedWhere {
  op: string;
  table: unknown;
  cond: unknown;
}
const capturedWhere: CapturedWhere[] = [];
const capturedInsertValues: Array<Record<string, unknown>> = [];
const capturedUpdateSet: Array<Record<string, unknown>> = [];
const capturedWorkOrderUpdateSet: Array<Record<string, unknown>> = [];

interface Ctx {
  op: "update" | "select" | "insert";
  table?: unknown;
}

function resolve(ctx: Ctx): unknown[] {
  if (ctx.op === "update" && ctx.table === workOrders) {
    return scenario.guardedUpdate;
  }
  if (ctx.op === "select" && ctx.table === workOrders) {
    return scenario.currentWorkOrder;
  }
  if (ctx.op === "insert" && ctx.table === syncConflicts) {
    return scenario.insertedConflict;
  }
  if (ctx.op === "select" && ctx.table === syncConflicts) {
    return scenario.selectConflicts;
  }
  if (ctx.op === "update" && ctx.table === syncConflicts) {
    return scenario.updateConflict;
  }
  return [];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function chainFor(ctx: Ctx): any {
  const chain: any = {
    set: (arg: Record<string, unknown>) => {
      if (ctx.table === syncConflicts) {
        capturedUpdateSet.push(arg);
      }
      if (ctx.table === workOrders) {
        capturedWorkOrderUpdateSet.push(arg);
      }
      return chain;
    },
    values: (arg: Record<string, unknown>) => {
      if (ctx.table === syncConflicts) {
        capturedInsertValues.push(arg);
      }
      return chain;
    },
    from: (t: unknown) => {
      ctx.table = t;
      return chain;
    },
    where: (cond: unknown) => {
      capturedWhere.push({ op: ctx.op, table: ctx.table, cond });
      return chain;
    },
    returning: async () => resolve(ctx),
    then: (res: (v: unknown[]) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(resolve(ctx)).then(res, rej),
  };
  return chain;
}

const fakeDb: any = {
  update: (t: unknown) => chainFor({ op: "update", table: t }),
  select: () => chainFor({ op: "select" }),
  insert: (t: unknown) => chainFor({ op: "insert", table: t }),
  transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(fakeDb),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

jest.unstable_mockModule("../../server/db", () => ({
  __esModule: true,
  db: fakeDb,
}));

// Recursively scan a drizzle SQL/condition object for a literal value.
function sqlContainsValue(node: unknown, target: string, depth = 0): boolean {
  if (depth > 8 || node == null) {
    return false;
  }
  if (typeof node === "string") {
    return node === target;
  }
  if (typeof node !== "object") {
    return false;
  }
  const obj = node as Record<string, unknown>;
  if ("value" in obj && obj["value"] === target) {
    return true;
  }
  for (const key of ["queryChunks", "value", "left", "right", "params", "list"]) {
    const v = obj[key];
    if (Array.isArray(v)) {
      if (v.some((x) => sqlContainsValue(x, target, depth + 1))) {
        return true;
      }
    } else if (v && typeof v === "object") {
      if (sqlContainsValue(v, target, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

type ServiceModule = typeof import("../../server/conflict-resolution-service");
let service: ServiceModule;

beforeAll(async () => {
  service = await import("../../server/conflict-resolution-service");
});

beforeEach(() => {
  scenario.guardedUpdate = [];
  scenario.currentWorkOrder = [];
  scenario.insertedConflict = [];
  scenario.selectConflicts = [];
  scenario.updateConflict = [];
  capturedWhere.length = 0;
  capturedInsertValues.length = 0;
  capturedUpdateSet.length = 0;
  capturedWorkOrderUpdateSet.length = 0;
});

describe("conflict allowlist", () => {
  it("reports work_orders as enabled and others as disabled", () => {
    expect(service.isConflictEnabledTable("work_orders")).toBe(true);
    expect(service.isConflictEnabledTable("equipment")).toBe(false);
    expect(service.listConflictEnabledTables()).toContain("work_orders");
  });

  it("refuses an update for a non-allowlisted table", async () => {
    await expect(
      service.applyOptimisticUpdate({
        orgId: ORG_A,
        table: "equipment",
        recordId: "eq1",
        data: { name: "x" },
        baseVersion: 1,
      })
    ).rejects.toBeInstanceOf(service.ConflictTableNotAllowedError);
  });
});

describe("payload validation", () => {
  it("rejects a malformed work-order payload", async () => {
    await expect(
      service.applyOptimisticUpdate({
        orgId: ORG_A,
        table: "work_orders",
        recordId: "wo1",
        data: { status: 123 },
        baseVersion: 1,
      })
    ).rejects.toBeInstanceOf(service.ConflictPayloadError);
  });
});

describe("applyOptimisticUpdate", () => {
  it("applies a non-conflicting edit and bumps the version", async () => {
    scenario.guardedUpdate = [{ version: 2 }];

    const outcome = await service.applyOptimisticUpdate({
      orgId: ORG_A,
      table: "work_orders",
      recordId: "wo1",
      data: { description: "updated" },
      baseVersion: 1,
    });

    expect(outcome).toEqual({ status: "applied", newVersion: 2 });

    const updateWhere = capturedWhere.find((w) => w.op === "update" && w.table === workOrders);
    expect(updateWhere).toBeDefined();
    expect(sqlContainsValue(updateWhere?.cond, ORG_A)).toBe(true);
  });

  it("detects a stale write, persists a conflict, and flags safety-critical fields", async () => {
    scenario.guardedUpdate = [];
    scenario.currentWorkOrder = [
      {
        id: "wo1",
        version: 5,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        lastModifiedBy: "bob",
        lastModifiedDevice: "tablet-2",
        status: "open",
      },
    ];
    scenario.insertedConflict = [
      {
        id: "c1",
        tableName: "work_orders",
        recordId: "wo1",
        fieldName: null,
        localVersion: 1,
        serverVersion: 5,
        isSafetyCritical: true,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];

    const outcome = await service.applyOptimisticUpdate({
      orgId: ORG_A,
      table: "work_orders",
      recordId: "wo1",
      data: { status: "closed" },
      baseVersion: 1,
      user: "alice",
      device: "tablet-1",
    });

    expect(outcome.status).toBe("conflict");
    if (outcome.status === "conflict") {
      expect(outcome.conflict.conflictId).toBe("c1");
      expect(outcome.conflict.isSafetyCritical).toBe(true);
    }

    expect(capturedInsertValues).toHaveLength(1);
    const persisted = capturedInsertValues[0]!;
    expect(persisted["orgId"]).toBe(ORG_A);
    expect(persisted["tableName"]).toBe("work_orders");
    expect(persisted["recordId"]).toBe("wo1");
    expect(persisted["localVersion"]).toBe(1);
    expect(persisted["serverVersion"]).toBe(5);
    expect(persisted["isSafetyCritical"]).toBe(true);
    expect(persisted["resolutionStrategy"]).toBe("manual");

    const selectWhere = capturedWhere.find((w) => w.op === "select" && w.table === workOrders);
    expect(sqlContainsValue(selectWhere?.cond, ORG_A)).toBe(true);
  });

  it("classifies a non-safety field change as auto-resolvable (lww)", async () => {
    scenario.guardedUpdate = [];
    scenario.currentWorkOrder = [{ id: "wo1", version: 5, updatedAt: new Date() }];
    scenario.insertedConflict = [
      {
        id: "c2",
        tableName: "work_orders",
        recordId: "wo1",
        isSafetyCritical: false,
        createdAt: new Date(),
      },
    ];

    const outcome = await service.applyOptimisticUpdate({
      orgId: ORG_A,
      table: "work_orders",
      recordId: "wo1",
      data: { description: "minor note" },
      baseVersion: 1,
    });

    expect(outcome.status).toBe("conflict");
    const persisted = capturedInsertValues[0]!;
    expect(persisted["isSafetyCritical"]).toBe(false);
    expect(persisted["resolutionStrategy"]).toBe("lww");
  });

  it("reports not-found when the record is absent from the caller's scope", async () => {
    scenario.guardedUpdate = [];
    scenario.currentWorkOrder = [];

    const outcome = await service.applyOptimisticUpdate({
      orgId: ORG_A,
      table: "work_orders",
      recordId: "missing",
      data: { description: "x" },
      baseVersion: 1,
    });

    expect(outcome).toEqual({ status: "not_found" });
    expect(capturedInsertValues).toHaveLength(0);
  });
});

describe("getPendingConflicts", () => {
  it("returns scoped conflicts with parsed local/server values", async () => {
    scenario.selectConflicts = [
      {
        id: "c1",
        tableName: "work_orders",
        recordId: "wo1",
        fieldName: null,
        localValue: JSON.stringify({ status: "closed" }),
        serverValue: JSON.stringify({ status: "open" }),
        localVersion: 1,
        serverVersion: 2,
        isSafetyCritical: true,
        createdAt: new Date(),
      },
    ];

    const conflicts = await service.getPendingConflicts(ORG_A);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.clientValue).toEqual({ status: "closed" });
    expect(conflicts[0]!.serverValue).toEqual({ status: "open" });

    const where = capturedWhere.find((w) => w.op === "select" && w.table === syncConflicts);
    expect(sqlContainsValue(where?.cond, ORG_A)).toBe(true);
  });
});

describe("manuallyResolveConflict scoping", () => {
  it("resolves a conflict that exists in the caller's scope", async () => {
    scenario.updateConflict = [{ id: "c1" }];

    const ok = await service.manuallyResolveConflict("c1", { status: "closed" }, "alice", ORG_A);

    expect(ok).toBe(true);
    const where = capturedWhere.find((w) => w.op === "update" && w.table === syncConflicts);
    expect(sqlContainsValue(where?.cond, ORG_A)).toBe(true);
    expect(sqlContainsValue(where?.cond, "c1")).toBe(true);
    expect(capturedUpdateSet[0]!["resolved"]).toBe(true);
  });

  it("denies resolution for a conflict outside the caller's scope", async () => {
    scenario.updateConflict = [];

    const ok = await service.manuallyResolveConflict("c1", { status: "closed" }, "mallory", ORG_B);

    expect(ok).toBe(false);
  });
});

describe("manuallyResolveConflict write-back (B1)", () => {
  it("writes a non-server winner back to the work order with a bumped version", async () => {
    scenario.updateConflict = [
      {
        id: "c1",
        tableName: "work_orders",
        recordId: "wo1",
        fieldName: null,
        serverValue: JSON.stringify({ description: "server note" }),
      },
    ];
    scenario.currentWorkOrder = [{ version: 7 }];

    const ok = await service.manuallyResolveConflict(
      "c1",
      { description: "local note" },
      "alice",
      ORG_A
    );

    expect(ok).toBe(true);
    expect(capturedWorkOrderUpdateSet).toHaveLength(1);
    const set = capturedWorkOrderUpdateSet[0]!;
    expect(set["description"]).toBe("local note");
    expect(set["version"]).toBe(8);
    expect(set["lastModifiedBy"]).toBe("alice");

    const woUpdate = capturedWhere.find((w) => w.op === "update" && w.table === workOrders);
    expect(woUpdate).toBeDefined();
    expect(sqlContainsValue(woUpdate?.cond, ORG_A)).toBe(true);
    expect(sqlContainsValue(woUpdate?.cond, "wo1")).toBe(true);
  });

  it("skips the domain write when the server value wins (no revert of newer state)", async () => {
    scenario.updateConflict = [
      {
        id: "c1",
        tableName: "work_orders",
        recordId: "wo1",
        fieldName: null,
        serverValue: JSON.stringify({ description: "server note" }),
      },
    ];
    scenario.currentWorkOrder = [{ version: 7 }];

    const ok = await service.manuallyResolveConflict(
      "c1",
      { description: "server note" },
      "alice",
      ORG_A
    );

    expect(ok).toBe(true);
    expect(capturedWorkOrderUpdateSet).toHaveLength(0);
  });

  it("resolves but does not write back for a non-work_orders table", async () => {
    scenario.updateConflict = [
      { id: "c1", tableName: "equipment", recordId: "eq1", fieldName: null, serverValue: null },
    ];

    const ok = await service.manuallyResolveConflict("c1", { foo: "bar" }, "alice", ORG_A);

    expect(ok).toBe(true);
    expect(capturedWorkOrderUpdateSet).toHaveLength(0);
  });

  it("resolves without a domain write when the record vanished", async () => {
    scenario.updateConflict = [
      {
        id: "c1",
        tableName: "work_orders",
        recordId: "gone",
        fieldName: null,
        serverValue: JSON.stringify({ description: "server note" }),
      },
    ];
    scenario.currentWorkOrder = [];

    const ok = await service.manuallyResolveConflict(
      "c1",
      { description: "local note" },
      "alice",
      ORG_A
    );

    expect(ok).toBe(true);
    expect(capturedWorkOrderUpdateSet).toHaveLength(0);
  });
});

describe("coerceResolvedWorkOrderFields", () => {
  it("lifts a field-level scalar winner into a single-column update", () => {
    expect(service.coerceResolvedWorkOrderFields("local note", "description")).toEqual({
      description: "local note",
    });
  });

  it("keeps known columns and strips server-managed / unknown keys for whole-record winners", () => {
    const fields = service.coerceResolvedWorkOrderFields(
      { description: "x", orgId: "tampered", version: 99 },
      null
    );
    expect(fields).toEqual({ description: "x" });
  });

  it("returns null for a scalar with no field name and for arrays", () => {
    expect(service.coerceResolvedWorkOrderFields("x", null)).toBeNull();
    expect(service.coerceResolvedWorkOrderFields([1, 2], null)).toBeNull();
  });
});

describe("lwwWinnerByServerReceipt (B7)", () => {
  it("picks local when the shore recorded the vessel edit after its own last write", () => {
    expect(service.lwwWinnerByServerReceipt(new Date("2026-01-10"), new Date("2026-01-05"))).toBe(
      "local"
    );
  });

  it("picks server when its last write is newer than the recorded vessel edit", () => {
    expect(service.lwwWinnerByServerReceipt(new Date("2026-01-01"), new Date("2026-01-05"))).toBe(
      "server"
    );
  });

  it("only considers server-stamped times — the vessel wall-clock cannot flip it", () => {
    // A null/missing server-receipt loses to any real server write, and a real
    // server-receipt beats a missing server write; no vessel timestamp is read.
    expect(service.lwwWinnerByServerReceipt(null, new Date("2026-01-05"))).toBe("server");
    expect(service.lwwWinnerByServerReceipt(new Date("2026-01-05"), null)).toBe("local");
  });
});

describe("getUnresolvedConflictsByIds", () => {
  it("short-circuits on an empty id list without querying", async () => {
    const rows = await service.getUnresolvedConflictsByIds(ORG_A, []);
    expect(rows).toEqual([]);
    expect(capturedWhere).toHaveLength(0);
  });

  it("scopes the lookup to the caller's org", async () => {
    scenario.selectConflicts = [{ id: "c1", orgId: ORG_A }];
    const rows = await service.getUnresolvedConflictsByIds(ORG_A, ["c1"]);
    expect(rows).toHaveLength(1);
    const where = capturedWhere.find((w) => w.op === "select" && w.table === syncConflicts);
    expect(sqlContainsValue(where?.cond, ORG_A)).toBe(true);
  });
});
