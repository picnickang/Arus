import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

type ChainTable = unknown;

class QueryChain<T = unknown[]> implements PromiseLike<T> {
  setArg: unknown;
  valuesArg: unknown;
  whereArgs: unknown[] = [];

  constructor(
    readonly result: T,
    readonly table?: ChainTable
  ) {}

  from(_table: ChainTable): this {
    return this;
  }

  leftJoin(): this {
    return this;
  }

  where(...args: unknown[]): this {
    this.whereArgs.push(...args);
    return this;
  }

  limit(): this {
    return this;
  }

  orderBy(): this {
    return this;
  }

  for(): this {
    return this;
  }

  set(value: unknown): this {
    this.setArg = value;
    return this;
  }

  values(value: unknown): this {
    this.valuesArg = value;
    return this;
  }

  returning(): Promise<T> {
    return Promise.resolve(this.result);
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function makeTx(
  fixtures: {
    select?: unknown[][];
    update?: unknown[][];
    insert?: unknown[][];
    delete?: unknown[][];
  } = {}
) {
  const state = {
    select: [...(fixtures.select ?? [])],
    update: [...(fixtures.update ?? [])],
    insert: [...(fixtures.insert ?? [])],
    delete: [...(fixtures.delete ?? [])],
  };
  const chains = {
    select: [] as QueryChain[],
    update: [] as QueryChain[],
    insert: [] as QueryChain[],
    delete: [] as QueryChain[],
  };
  return {
    chains,
    select: jest.fn(() => {
      const chain = new QueryChain(state.select.shift() ?? []);
      chains.select.push(chain);
      return chain;
    }),
    update: jest.fn((table: ChainTable) => {
      const chain = new QueryChain(state.update.shift() ?? [], table);
      chains.update.push(chain);
      return chain;
    }),
    insert: jest.fn((table: ChainTable) => {
      const chain = new QueryChain(state.insert.shift() ?? [], table);
      chains.insert.push(chain);
      return chain;
    }),
    delete: jest.fn((table: ChainTable) => {
      const chain = new QueryChain(state.delete.shift() ?? [], table);
      chains.delete.push(chain);
      return chain;
    }),
  };
}

const dbMock = {
  transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(makeTx())),
  select: jest.fn(),
  delete: jest.fn(),
};

const dbWorkOrderStorage = {
  generateWorkOrderNumber: jest.fn<() => Promise<string>>(),
  getWorkOrder: jest.fn<() => Promise<{ id: string }>>(),
  getWorkOrderById: jest.fn<() => Promise<{ id: string }>>(),
  createWorkOrder: jest.fn<() => Promise<{ id: string }>>(),
  deleteWorkOrder: jest.fn(),
  getWorkOrderParts: jest.fn<() => Promise<{ id: string }[]>>(),
  getWorkOrderTasks: jest.fn<() => Promise<{ id: string }[]>>(),
  getWorkOrderChecklists: jest.fn<() => Promise<{ id: string }[]>>(),
  getWorkOrderWorklogs: jest.fn<() => Promise<{ id: string }[]>>(),
  getWorkOrderCompletions: jest.fn<
    () => Promise<
      Array<{
        actualDowntimeHours: number;
        onTimeCompletion: boolean;
        durationVariancePercent?: number;
        costVariancePercent?: number;
      }>
    >
  >(),
};

const dbInventoryStorage = {
  releasePartsFromWorkOrder: jest.fn(),
};

const fireInventoryMovementProjections = jest.fn();
const publishEvent = jest.fn();
const broadcastWorkOrderChange = jest.fn();

jest.unstable_mockModule("../../db-config", () => ({
  __esModule: true,
  db: dbMock,
  deploymentMode: "VESSEL",
  isLocalMode: true,
}));

jest.unstable_mockModule("../../db/workorders/index.js", () => ({
  __esModule: true,
  dbWorkOrderStorage,
}));

jest.unstable_mockModule("../../db/inventory/index.js", () => ({
  __esModule: true,
  dbInventoryStorage,
  fireInventoryMovementProjections,
}));

jest.unstable_mockModule("../../sync-events.js", () => ({
  __esModule: true,
  publishEvent,
}));

jest.unstable_mockModule("../../websocket-server", () => ({
  __esModule: true,
  getWebSocketServer: () => ({ broadcastWorkOrderChange }),
}));

type WorkOrderService = typeof import("./work-order-service").workOrderService;

let service: WorkOrderService;

beforeAll(async () => {
  ({ workOrderService: service } = await import("./work-order-service"));
});

beforeEach(() => {
  jest.clearAllMocks();
  dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(makeTx())
  );
});

describe("legacy WorkOrderService delegation and analytics", () => {
  it("delegates direct repository operations through the canonical work-order storage", async () => {
    dbWorkOrderStorage.generateWorkOrderNumber.mockResolvedValue("WO-2026-0001");
    dbWorkOrderStorage.getWorkOrder.mockResolvedValue({ id: "wo-1" });
    dbWorkOrderStorage.getWorkOrderById.mockResolvedValue({ id: "wo-2" });
    dbWorkOrderStorage.createWorkOrder.mockResolvedValue({ id: "wo-created" });
    dbWorkOrderStorage.getWorkOrderParts.mockResolvedValue([{ id: "part-link" }]);
    dbWorkOrderStorage.getWorkOrderTasks.mockResolvedValue([{ id: "task-1" }]);
    dbWorkOrderStorage.getWorkOrderChecklists.mockResolvedValue([{ id: "checklist-1" }]);
    dbWorkOrderStorage.getWorkOrderWorklogs.mockResolvedValue([{ id: "worklog-1" }]);

    await expect(service.generateWorkOrderNumber("org-1")).resolves.toBe("WO-2026-0001");
    await expect(service.getWorkOrder("org-1", "wo-1")).resolves.toEqual({ id: "wo-1" });
    await expect(service.getWorkOrderById("wo-2", "org-1")).resolves.toEqual({ id: "wo-2" });
    await expect(service.createWorkOrder({ orgId: "org-1" } as never)).resolves.toEqual({
      id: "wo-created",
    });
    await service.deleteWorkOrder("wo-3");
    await expect(service.getWorkOrderParts("wo-1")).resolves.toEqual([{ id: "part-link" }]);
    await expect(service.getWorkOrderTasks("wo-1")).resolves.toEqual([{ id: "task-1" }]);
    await expect(service.getWorkOrderChecklists("wo-1")).resolves.toEqual([{ id: "checklist-1" }]);
    await expect(service.getWorkOrderWorklogs("wo-1")).resolves.toEqual([{ id: "worklog-1" }]);

    expect(dbWorkOrderStorage.deleteWorkOrder).toHaveBeenCalledWith("wo-3");
  });

  it("aggregates completion analytics and returns a zero baseline for empty data", async () => {
    dbWorkOrderStorage.getWorkOrderCompletions.mockResolvedValueOnce([]);
    await expect(service.getWorkOrderCompletionAnalytics({ orgId: "org-1" })).resolves.toEqual({
      totalCompletions: 0,
      avgDurationVariance: 0,
      avgCostVariance: 0,
      onTimeCompletionRate: 0,
      totalDowntimeHours: 0,
    });

    dbWorkOrderStorage.getWorkOrderCompletions.mockResolvedValueOnce([
      {
        actualDowntimeHours: 2,
        durationVariancePercent: 10,
        costVariancePercent: 20,
        onTimeCompletion: true,
      },
      {
        actualDowntimeHours: 3,
        durationVariancePercent: 30,
        costVariancePercent: 40,
        onTimeCompletion: false,
      },
      { actualDowntimeHours: 1, onTimeCompletion: true },
    ]);

    await expect(service.getWorkOrderCompletionAnalytics({ orgId: "org-1" })).resolves.toEqual({
      totalCompletions: 3,
      avgDurationVariance: 20,
      avgCostVariance: 30,
      onTimeCompletionRate: (2 / 3) * 100,
      totalDowntimeHours: 6,
    });
  });
});

describe("legacy WorkOrderService completion and inventory side effects", () => {
  it("completes a work order inside a supplied transaction and records inventory consumption projections", async () => {
    const tx = makeTx({
      update: [[{ id: "wo-1", woNumber: "WO-1" }], []],
      insert: [[{ id: "completion-1", workOrderId: "wo-1", orgId: "org-1" }], []],
      select: [
        [{ partId: "part-1", quantityUsed: 3 }],
        [{ id: "stock-1", partId: "part-1", quantityOnHand: 10, quantityReserved: 5 }],
      ],
    });

    const result = await service.completeWorkOrderInTx(tx as never, "wo-1", {
      orgId: "org-1",
      completedBy: "chief",
      totalLaborCost: 40,
      totalPartsCost: 60,
      actualDowntimeHours: 2,
      downtimeCostPerHour: 500,
    } as never);

    expect(result.completion).toEqual({
      id: "completion-1",
      workOrderId: "wo-1",
      orgId: "org-1",
    });
    expect(result.pendingProjections).toEqual([
      expect.objectContaining({
        partId: "part-1",
        workOrderId: "wo-1",
        movementType: "consume",
      }),
    ]);
    expect(tx.chains.update[0].setArg).toEqual(
      expect.objectContaining({
        status: "completed",
        totalLaborCost: 40,
        totalPartsCost: 60,
        totalCost: 1100,
        actualDowntimeHours: 2,
        downtimeCostPerHour: 500,
      })
    );
    expect(tx.chains.update[1].setArg).toEqual(
      expect.objectContaining({ quantityOnHand: 7, quantityReserved: 2 })
    );
    expect(tx.chains.insert[1].valuesArg).toEqual(
      expect.objectContaining({
        orgId: "org-1",
        partId: "part-1",
        workOrderId: "wo-1",
        movementType: "consume",
        quantity: -3,
        quantityBefore: 10,
        quantityAfter: 7,
        reservedBefore: 5,
        reservedAfter: 2,
        performedBy: "chief",
      })
    );
  });

  it("fires inventory projections only after the completion transaction commits", async () => {
    const tx = makeTx({
      update: [[{ id: "wo-1", woNumber: "WO-1" }], []],
      insert: [[{ id: "completion-1", workOrderId: "wo-1", orgId: "org-1" }], []],
      select: [
        [{ partId: "part-1", quantityUsed: 2 }],
        [{ id: "stock-1", partId: "part-1", quantityOnHand: 4, quantityReserved: 2 }],
      ],
    });
    const timeline: string[] = [];
    dbMock.transaction.mockImplementationOnce(async (callback) => {
      timeline.push("transaction:start");
      const value = await callback(tx);
      timeline.push("transaction:commit");
      return value;
    });
    fireInventoryMovementProjections.mockImplementationOnce(async () => {
      timeline.push("projection");
    });

    await expect(
      service.completeWorkOrder("wo-1", { orgId: "org-1", completedBy: "chief" } as never)
    ).resolves.toEqual({ id: "completion-1", workOrderId: "wo-1", orgId: "org-1" });

    expect(timeline).toEqual(["transaction:start", "transaction:commit", "projection"]);
    expect(fireInventoryMovementProjections).toHaveBeenCalledWith("org-1", [
      expect.objectContaining({ partId: "part-1", movementType: "consume" }),
    ]);
  });
});

describe("legacy WorkOrderService clone and cleanup behavior", () => {
  it("clones work orders, tasks, and parts inside the transaction, then publishes after commit", async () => {
    const tx = makeTx({
      select: [
        [
          {
            id: "wo-original",
            orgId: "org-1",
            woNumber: "WO-OLD",
            status: "completed",
            plannedStartDate: new Date("2026-01-01T00:00:00.000Z"),
            plannedEndDate: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
        [{ id: "task-1", workOrderId: "wo-original", isCompleted: true }],
        [{ id: "part-link-1", workOrderId: "wo-original", quantityUsed: 4, totalCost: 25 }],
      ],
      insert: [[{ id: "wo-clone", orgId: "org-1", woNumber: "WO-NEW" }], [], []],
    });
    const timeline: string[] = [];
    dbMock.transaction.mockImplementationOnce(async (callback) => {
      timeline.push("transaction:start");
      const value = await callback(tx);
      timeline.push("transaction:commit");
      return value;
    });
    dbWorkOrderStorage.generateWorkOrderNumber.mockResolvedValueOnce("WO-NEW");
    publishEvent.mockImplementationOnce(async () => {
      timeline.push("publish");
    });

    await expect(
      service.cloneWorkOrder("wo-original", "org-1", {
        includeTasks: true,
        includeParts: true,
        plannedStartDate: new Date("2026-02-01T00:00:00.000Z"),
      })
    ).resolves.toEqual({ id: "wo-clone", orgId: "org-1", woNumber: "WO-NEW" });

    expect(timeline).toEqual(["transaction:start", "transaction:commit", "publish"]);
    expect(tx.chains.insert[0].valuesArg).toEqual(
      expect.objectContaining({
        woNumber: "WO-NEW",
        status: "open",
        actualStartDate: null,
        actualEndDate: null,
        totalPartsCost: 0,
        totalLaborCost: 0,
        totalCost: 0,
        vesselDowntimeStartedAt: null,
      })
    );
    expect(tx.chains.insert[1].valuesArg).toEqual([
      expect.objectContaining({
        id: undefined,
        workOrderId: "wo-clone",
        isCompleted: false,
        completedAt: null,
      }),
    ]);
    expect(tx.chains.insert[2].valuesArg).toEqual([
      expect.objectContaining({
        id: undefined,
        workOrderId: "wo-clone",
        quantityUsed: 0,
        totalCost: 0,
      }),
    ]);
    expect(publishEvent).toHaveBeenCalledWith("work_order.created", {
      id: "wo-clone",
      orgId: "org-1",
      woNumber: "WO-NEW",
    });
  });

  it("does not publish a clone event when the source work order is missing", async () => {
    dbMock.transaction.mockImplementationOnce(async (callback) =>
      callback(makeTx({ select: [[]] }))
    );

    await expect(service.cloneWorkOrder("missing", "org-1")).rejects.toThrow(
      "Work order missing not found"
    );
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("releases reserved inventory before cascading child rows and broadcasting delete", async () => {
    const selectChain = new QueryChain([{ orgId: "org-1" }]);
    const deleteResults = [[], [], [], [], [{ id: "wo-delete" }]];
    const deleteChains: QueryChain[] = [];
    dbMock.select.mockReturnValueOnce(selectChain);
    dbMock.delete.mockImplementation(() => {
      const chain = new QueryChain(deleteResults.shift() ?? []);
      deleteChains.push(chain);
      return chain;
    });

    await service.deleteWorkOrderCascade("wo-delete");

    expect(dbInventoryStorage.releasePartsFromWorkOrder).toHaveBeenCalledWith("wo-delete", "org-1");
    expect(dbMock.delete).toHaveBeenCalledTimes(5);
    expect(deleteChains[4].result).toEqual([{ id: "wo-delete" }]);
    expect(broadcastWorkOrderChange).toHaveBeenCalledWith("delete", { id: "wo-delete" });
  });
});
