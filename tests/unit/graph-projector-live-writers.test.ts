/**
 * Task #81 — Live graph projector wiring tests.
 *
 * Push A2 shipped the graph substrate plus an idempotent backfill but
 * deliberately left live write-path emission out of that PR. This test
 * pins the contract that the three canonical writers — equipment,
 * failure_history, inventory_movements — call their respective graph
 * projector after a successful relational write, AND that the live
 * `FailureHistoryAdapter` (work-orders domain) actually routes through
 * the canonical `createFailureHistory` writer rather than inlining its
 * own INSERT + projector call.
 *
 * Strategy: mock the graph projector module and the `db` proxy so we
 * can drive each writer end-to-end without a real database
 * (tests/integration/README.md documents why real-DB integration
 * tests with the dual PG/SQLite schema are not run by default, and
 * the graph substrate itself — Apache AGE — is not available in the
 * default test runner). The assertion is shape-level: "the projector
 * was called with the expected payload derived from the inserted
 * row". A graph failure MUST NEVER fail the underlying write — the
 * writer wraps every projector call in try/catch (`safe()` inside
 * the projector itself already swallows internal errors).
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Mock signatures mirror the production projector module so `mock.calls`
// destructures yield typed (orgId, projection) tuples in the assertions.
type ProjectorModule = typeof import("../../server/graph/projector");

type ProjectorMock = {
  projectEquipment: jest.Mock<ProjectorModule["projectEquipment"]>;
  projectFailureHistory: jest.Mock<ProjectorModule["projectFailureHistory"]>;
  projectInventoryMovement: jest.Mock<ProjectorModule["projectInventoryMovement"]>;
  retractInstalledOn: jest.Mock<ProjectorModule["retractInstalledOn"]>;
  projectDependency: jest.Mock<ProjectorModule["projectDependency"]>;
  retractDependency: jest.Mock<ProjectorModule["retractDependency"]>;
};

const projectorMock: ProjectorMock = {
  projectEquipment: jest.fn<ProjectorModule["projectEquipment"]>(async () => undefined),
  projectFailureHistory: jest.fn<ProjectorModule["projectFailureHistory"]>(async () => undefined),
  projectInventoryMovement: jest.fn<ProjectorModule["projectInventoryMovement"]>(
    async () => undefined
  ),
  retractInstalledOn: jest.fn<ProjectorModule["retractInstalledOn"]>(async () => undefined),
  projectDependency: jest.fn<ProjectorModule["projectDependency"]>(async () => undefined),
  retractDependency: jest.fn<ProjectorModule["retractDependency"]>(async () => undefined),
};

jest.unstable_mockModule("../../server/graph/projector", () => projectorMock);

/**
 * Minimal db chain mock. Each writer uses a different fluent shape:
 *   .insert(table).values(...).returning() → fake row(s)
 *   .select({...}).from(table).where(...).limit(1) → []
 *   .update(table).set(...).where(...).returning() → fake row(s)
 *   .transaction(cb) → cb(tx) where tx mirrors the same chain
 *
 * `nextInsertReturning` queue lets each test pre-seed the rows the
 * SUT's `.insert().returning()` should resolve with.
 */
const insertQueue: unknown[][] = [];
const selectQueue: unknown[][] = [];

type ChainNode = Record<string, unknown> & {
  returning: () => Promise<unknown[]>;
  then: (onF: (rows: unknown[]) => unknown) => Promise<unknown>;
};

function chain(returningRows: unknown[]): ChainNode {
  const node: ChainNode = {
    returning: async () => returningRows,
    then: (onF) => Promise.resolve(returningRows).then(onF),
  };
  for (const key of [
    "values",
    "set",
    "from",
    "where",
    "leftJoin",
    "innerJoin",
    "orderBy",
    "limit",
    "offset",
    "groupBy",
    "onConflictDoNothing",
  ]) {
    node[key] = () => node;
  }
  return node;
}

const dbMock = {
  insert: () => {
    const rows = insertQueue.shift() ?? [];
    return chain(rows);
  },
  select: () => {
    const rows = selectQueue.shift() ?? [];
    return chain(rows);
  },
  update: () => chain(insertQueue.shift() ?? []),
  delete: () => chain([]),
  transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(dbMock),
  execute: async () => ({ rows: [] }),
};

jest.unstable_mockModule("../../server/db-config", () => ({
  db: dbMock,
  pool: null,
  isLocalMode: false,
  deploymentMode: "CLOUD (Online)",
  libsqlClient: null,
  tables: {},
}));

jest.unstable_mockModule("../../server/db/equipment/websocket.js", () => ({
  getWebSocketServer: () => null,
}));

// equipment-analytics-service is dynamically imported inside
// createEquipment(); stub it so we don't pull in unrelated heavy deps.
jest.unstable_mockModule("../../server/equipment-analytics-service.js", () => ({
  equipmentAnalyticsService: { setupEquipmentAnalytics: async () => undefined },
}));

beforeEach(() => {
  projectorMock.projectEquipment.mockClear();
  projectorMock.projectFailureHistory.mockClear();
  projectorMock.projectInventoryMovement.mockClear();
  projectorMock.retractInstalledOn.mockClear();
  insertQueue.length = 0;
  selectQueue.length = 0;
});

describe("Task #81 — live graph projector wiring", () => {
  it("keeps inventory index as a facade over projection and work-order helpers", () => {
    const inventoryDir = join(process.cwd(), "server", "db", "inventory");
    const index = readFileSync(join(inventoryDir, "index.ts"), "utf-8");
    const projections = readFileSync(join(inventoryDir, "inventory-projections.ts"), "utf-8");
    const reservations = readFileSync(join(inventoryDir, "reservation-ledger.ts"), "utf-8");
    const workOrders = readFileSync(join(inventoryDir, "work-order-parts.ts"), "utf-8");

    expect(index).toContain('from "./inventory-projections.js"');
    expect(index).toContain('from "./work-order-parts.js"');
    expect(index).not.toContain("async function fireProjectionsAfterCommit");
    expect(projections).toContain("export async function fireInventoryMovementProjections");
    expect(reservations).toContain("export async function allocateReservation");
    expect(workOrders).toContain("export async function reservePartsForWorkOrder");
  });

  it("createEquipment fires projectEquipment with the inserted row", async () => {
    const { DatabaseEquipmentStorage } = await import("../../server/db/equipment/db-equipment");
    const newRow = {
      id: "eq-A",
      orgId: "org-1",
      name: "Main Engine",
      type: "engine",
      vesselId: "vsl-1",
      systemType: "propulsion",
    };
    // First select(): vessel-name lookup → no row. Second insert: returning row.
    selectQueue.push([]); // vessel name lookup in createEquipment
    insertQueue.push([newRow]); // .insert(equipment).returning()

    const storage = new DatabaseEquipmentStorage();
    const result = await storage.createEquipment(
      newRow as Parameters<typeof storage.createEquipment>[0]
    );

    expect(result).toEqual(newRow);
    expect(projectorMock.projectEquipment).toHaveBeenCalledTimes(1);
    const [orgIdArg, projection] = projectorMock.projectEquipment.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(projection).toMatchObject({
      id: "eq-A",
      name: "Main Engine",
      type: "engine",
      vesselId: "vsl-1",
      systemType: "propulsion",
    });
  });

  it("createFailureHistory fires projectFailureHistory after commit", async () => {
    const { DatabaseMlAnalyticsStorage } = await import(
      "../../server/db/ml-analytics/db-ml-analytics"
    );
    const insertedRow = {
      id: 42,
      orgId: "org-1",
      equipmentId: "eq-A",
      failureMode: "bearing-wear",
      verifiedBy: "tech-7",
      workOrderId: "wo-9",
    };
    insertQueue.push([insertedRow]);

    const storage = new DatabaseMlAnalyticsStorage();
    const result = await storage.createFailureHistory(
      {
        equipmentId: "eq-A",
        failureMode: "bearing-wear",
        verifiedBy: "tech-7",
        workOrderId: "wo-9",
        failureTimestamp: new Date(),
        failureSeverity: "high",
      } as Parameters<typeof storage.createFailureHistory>[0],
      "org-1"
    );

    expect(result.id).toBe(42);
    expect(projectorMock.projectFailureHistory).toHaveBeenCalledTimes(1);
    const [orgIdArg, payload] = projectorMock.projectFailureHistory.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(payload).toMatchObject({
      failureHistoryId: 42,
      equipmentId: "eq-A",
      failureMode: "bearing-wear",
      technicianId: "tech-7",
      workOrderId: "wo-9",
    });
  });

  it("reservePartsForWorkOrder fires projectInventoryMovement per reservation", async () => {
    // Pre-seed the (now mocked) db reads/writes that
    // reservePartsForWorkOrder walks inside its transaction:
    //   1. select workOrderParts → one row, partId=P1, qty=3
    //   2. select stock for allocateReservation → one row with 10 on hand
    //   3. update stock (returning ignored)
    //   4. insert inventoryMovements (returning ignored)
    // Then the post-commit fireProjectionsAfterCommit does:
    //   5. select parts metadata → one row
    //   6. select failure_history for wo → empty (no failure linkage)
    selectQueue.push([{ partId: "P1", quantityUsed: 3, orgId: "org-1", workOrderId: "wo-1" }]); // workOrderParts
    selectQueue.push([
      {
        id: "stock-1",
        partId: "P1",
        orgId: "org-1",
        quantityOnHand: 10,
        quantityReserved: 0,
      },
    ]); // stock for allocateReservation
    insertQueue.push([]); // update stock (no returning needed)
    insertQueue.push([]); // insert inventoryMovements
    selectQueue.push([{ id: "P1", name: "Pump Seal", primarySupplierId: "sup-1" }]); // partsTable in fireProjectionsAfterCommit
    selectQueue.push([]); // failureHistory lookup in fireProjectionsAfterCommit

    const { DatabaseInventoryStorage } = await import("../../server/db/inventory/index");
    const storage = new DatabaseInventoryStorage();
    await storage.reservePartsForWorkOrder("wo-1", "org-1");

    expect(projectorMock.projectInventoryMovement).toHaveBeenCalledTimes(1);
    const [orgIdArg, payload] = projectorMock.projectInventoryMovement.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(payload).toMatchObject({
      partId: "P1",
      workOrderId: "wo-1",
      partName: "Pump Seal",
      supplierId: "sup-1",
      failureMode: null,
    });
    expect(payload.movementId).toBeDefined();
  });

  it("releasePartsFromWorkOrder records release movement projections after reservation release", async () => {
    selectQueue.push([{ partId: "P1", quantityUsed: 2, orgId: "org-1", workOrderId: "wo-1" }]); // workOrderParts
    selectQueue.push([
      {
        id: "stock-1",
        partId: "P1",
        orgId: "org-1",
        quantityOnHand: 10,
        quantityReserved: 5,
      },
    ]); // stock for distributeRelease
    insertQueue.push([]); // update stock
    insertQueue.push([]); // insert inventoryMovements
    selectQueue.push([{ id: "P1", name: "Pump Seal", primarySupplierId: "sup-1" }]); // parts metadata

    const { DatabaseInventoryStorage } = await import("../../server/db/inventory/index");
    const storage = new DatabaseInventoryStorage();
    await storage.releasePartsFromWorkOrder("wo-1", "org-1");

    expect(projectorMock.projectInventoryMovement).toHaveBeenCalledTimes(1);
    const [orgIdArg, payload] = projectorMock.projectInventoryMovement.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(payload).toMatchObject({
      partId: "P1",
      workOrderId: "wo-1",
      partName: "Pump Seal",
      supplierId: "sup-1",
      failureMode: null,
    });
  });

  it("removePartAndRestoreInventory returns reserved stock before deleting the work-order part", async () => {
    selectQueue.push([
      {
        id: "wop-1",
        partId: "P1",
        quantityUsed: 2,
        orgId: "org-1",
        workOrderId: "wo-1",
      },
    ]); // workOrderPart lookup
    selectQueue.push([
      {
        id: "stock-1",
        partId: "P1",
        orgId: "org-1",
        quantityOnHand: 10,
        quantityReserved: 5,
      },
    ]); // stock for distributeRelease
    insertQueue.push([]); // update stock
    insertQueue.push([]); // insert inventoryMovements
    selectQueue.push([{ id: "wo-1", orgId: "org-1", totalLaborCost: 25 }]); // work order
    selectQueue.push([{ totalCost: 8 }]); // remaining parts cost
    insertQueue.push([]); // update work order totals
    selectQueue.push([{ id: "P1", name: "Pump Seal", primarySupplierId: "sup-1" }]); // parts metadata

    const { DatabaseInventoryStorage } = await import("../../server/db/inventory/index");
    const storage = new DatabaseInventoryStorage();
    await storage.removePartAndRestoreInventory("wop-1", "org-1", "tech-1");

    expect(projectorMock.projectInventoryMovement).toHaveBeenCalledTimes(1);
    const [orgIdArg, payload] = projectorMock.projectInventoryMovement.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(payload).toMatchObject({
      partId: "P1",
      workOrderId: "wo-1",
      partName: "Pump Seal",
      supplierId: "sup-1",
      failureMode: null,
    });
  });

  it("addBulkPartsAndReserveInventory inserts the work-order part, reserves stock, and projects movement", async () => {
    selectQueue.push([]); // existing workOrderParts
    selectQueue.push([{ unitCost: 14 }]); // stock cost lookup for the part
    insertQueue.push([
      {
        id: "wop-1",
        orgId: "org-1",
        workOrderId: "wo-1",
        partId: "P1",
        quantityUsed: 4,
        unitCost: 14,
        totalCost: 56,
      },
    ]); // inserted work-order part
    selectQueue.push([{ partId: "P1", quantityUsed: 4, orgId: "org-1", workOrderId: "wo-1" }]); // all workOrderParts after insert
    selectQueue.push([
      {
        id: "stock-1",
        partId: "P1",
        orgId: "org-1",
        quantityOnHand: 12,
        quantityReserved: 1,
      },
    ]); // stock for allocateReservation
    insertQueue.push([]); // update stock
    insertQueue.push([]); // insert inventoryMovements
    selectQueue.push([{ id: "P1", name: "Pump Seal", primarySupplierId: "sup-1" }]); // parts metadata
    selectQueue.push([]); // failureHistory lookup for consuming movement

    const { DatabaseInventoryStorage } = await import("../../server/db/inventory/index");
    const storage = new DatabaseInventoryStorage();
    const result = await storage.addBulkPartsAndReserveInventory(
      "wo-1",
      [{ partId: "P1", quantity: 4, usedBy: "tech-1", notes: "planned job" }],
      "org-1"
    );

    expect(result.errors).toEqual([]);
    expect(result.added).toHaveLength(1);
    expect(projectorMock.projectInventoryMovement).toHaveBeenCalledTimes(1);
    const [orgIdArg, payload] = projectorMock.projectInventoryMovement.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(payload).toMatchObject({
      partId: "P1",
      workOrderId: "wo-1",
      partName: "Pump Seal",
      supplierId: "sup-1",
      failureMode: null,
    });
  });

  it("inventory work-order mutation paths fail closed without org context", async () => {
    const { DatabaseInventoryStorage } = await import("../../server/db/inventory/index");
    const storage = new DatabaseInventoryStorage();

    await expect(storage.reservePartsForWorkOrder("wo-1", "")).rejects.toThrow("orgId is required");
    await expect(storage.releasePartsFromWorkOrder("wo-1", "")).rejects.toThrow(
      "orgId is required"
    );
    await expect(storage.addBulkPartsAndReserveInventory("wo-1", [], "")).rejects.toThrow(
      "orgId is required"
    );
    await expect(storage.removePartAndRestoreInventory("wop-1", "", "tech-1")).rejects.toThrow(
      "orgId is required"
    );
  });

  it("FailureHistoryAdapter (live work-order closeout path) routes through the canonical createFailureHistory writer", async () => {
    // tests/mocks/schema-runtime.ts exports IS_POSTGRES=true so the
    // PG branch in the adapter is active; the SQLite branch short-
    // circuits by design (different `failure_history` schema).
    const insertedRow = {
      id: 101,
      orgId: "org-1",
      equipmentId: "eq-X",
      failureMode: "seal-leak",
      verifiedBy: "tech-3",
      workOrderId: "wo-42",
    };
    insertQueue.push([insertedRow]); // canonical writer's .insert().returning()

    const { FailureHistoryAdapter } = await import(
      "../../server/domains/work-orders/infrastructure/workflow-adapters"
    );
    const adapter = new FailureHistoryAdapter();
    await adapter.recordFailure({
      orgId: "org-1",
      workOrderId: "wo-42",
      equipmentId: "eq-X",
      cause: "seal-leak",
      severity: "high",
      recordedBy: "tech-3",
      recordedAt: new Date(),
    });

    // Single projector call sourced from the canonical writer —
    // closes the loop the code-review flagged: the adapter no
    // longer inlines its own INSERT + projector call.
    expect(projectorMock.projectFailureHistory).toHaveBeenCalledTimes(1);
    const [orgIdArg, payload] = projectorMock.projectFailureHistory.mock.calls[0];
    expect(orgIdArg).toBe("org-1");
    expect(payload).toMatchObject({
      failureHistoryId: 101,
      equipmentId: "eq-X",
      failureMode: "seal-leak",
      technicianId: "tech-3",
      workOrderId: "wo-42",
    });
  });

  it("projector failures never propagate out of createEquipment", async () => {
    projectorMock.projectEquipment.mockImplementationOnce(async () => {
      throw new Error("graph down");
    });
    selectQueue.push([]);
    insertQueue.push([
      {
        id: "eq-B",
        orgId: "org-1",
        name: "Aux",
        type: "pump",
        vesselId: null,
        systemType: null,
      },
    ]);
    const { DatabaseEquipmentStorage } = await import("../../server/db/equipment/db-equipment");
    const storage = new DatabaseEquipmentStorage();
    await expect(
      storage.createEquipment({
        id: "eq-B",
        orgId: "org-1",
        name: "Aux",
        type: "pump",
      } as Parameters<typeof storage.createEquipment>[0])
    ).resolves.toMatchObject({ id: "eq-B" });
  });
});
