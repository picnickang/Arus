import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type SelectRow = Record<string, unknown>;

const tableIds = {
  costModel: { __table: "costModel", downtimePerHour: "costModel.downtimePerHour" },
  equipment: { __table: "equipment", downtimeCostPerHour: "equipment.downtimeCostPerHour" },
  serviceOrders: {
    __table: "serviceOrders",
    actualAmount: "serviceOrders.actualAmount",
    id: "serviceOrders.id",
    orgId: "serviceOrders.orgId",
    quotedAmount: "serviceOrders.quotedAmount",
    serviceProviderId: "serviceOrders.serviceProviderId",
    soNumber: "serviceOrders.soNumber",
    status: "serviceOrders.status",
    workOrderId: "serviceOrders.workOrderId",
  },
  workOrderParts: {
    __table: "workOrderParts",
    totalCost: "workOrderParts.totalCost",
    workOrderId: "workOrderParts.workOrderId",
  },
  workOrders: {
    __table: "workOrders",
    actualDowntimeHours: "workOrders.actualDowntimeHours",
    downtimeCostPerHour: "workOrders.downtimeCostPerHour",
    equipmentId: "workOrders.equipmentId",
    id: "workOrders.id",
    orgId: "workOrders.orgId",
    totalLaborCost: "workOrders.totalLaborCost",
  },
};

const selectQueues = new Map<string, SelectRow[][]>();
const updateCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];

function enqueueSelect(table: string, rows: SelectRow[]): void {
  const queue = selectQueues.get(table) ?? [];
  queue.push(rows);
  selectQueues.set(table, queue);
}

function dequeueSelect(table: string): SelectRow[] {
  const queue = selectQueues.get(table) ?? [];
  const rows = queue.shift();
  if (!rows) {
    throw new Error(`No mocked select rows queued for ${table}`);
  }
  return rows;
}

function tableName(table: unknown): string {
  const candidate = table as { __table?: string };
  return candidate.__table ?? "unknown";
}

function selectQueryFor(table: unknown) {
  const rows = () => Promise.resolve(dequeueSelect(tableName(table)));
  const whereResult = {
    limit: jest.fn(async () => rows()),
    then: (resolve: (value: SelectRow[]) => void, reject: (reason: unknown) => void) =>
      rows().then(resolve, reject),
  };
  return {
    where: jest.fn(() => whereResult),
  };
}

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn((table: unknown) => selectQueryFor(table)),
  })),
  update: jest.fn((table: unknown) => ({
    set: jest.fn((values: Record<string, unknown>) => {
      updateCalls.push({ table, values });
      return {
        where: jest.fn(async () => []),
      };
    }),
  })),
};

jest.unstable_mockModule("../db", () => ({
  db: mockDb,
}));

jest.unstable_mockModule("@shared/schema-runtime", () => tableIds);

jest.unstable_mockModule("drizzle-orm", () => ({
  and: (...clauses: unknown[]) => ({ clauses, op: "and" }),
  eq: (left: unknown, right: unknown) => ({ left, op: "eq", right }),
}));

const { aggregateProcurementCostsToWorkOrder, getWorkOrderProcurementCosts } = await import(
  "./procurement-costs"
);

describe("Procurement cost rollup", () => {
  beforeEach(() => {
    selectQueues.clear();
    updateCalls.length = 0;
    jest.clearAllMocks();
  });

  it("does not count draft service order amounts and resolves downtime from equipment", async () => {
    enqueueSelect("serviceOrders", [
      {
        actualAmount: 4200,
        id: "so-draft",
        quotedAmount: 5000,
        serviceProviderId: "supplier-1",
        soNumber: "SO-0001",
        status: "draft",
      },
    ]);
    enqueueSelect("workOrders", [{ downtimeCostPerHour: null, equipmentId: "eq-1" }]);
    enqueueSelect("equipment", [{ downtimeCostPerHour: 1750 }]);
    enqueueSelect("costModel", [{ downtimePerHour: 2100 }]);

    const costs = await getWorkOrderProcurementCosts("wo-1", "org-1");

    expect(costs).toMatchObject({
      resolvedDowntimeCostPerHour: 1750,
      serviceOrderCosts: 0,
      totalProcurementCost: 0,
    });
    expect(costs.serviceOrderDetails).toEqual([
      {
        actualAmount: 4200,
        id: "so-draft",
        quotedAmount: 5000,
        serviceProviderId: "supplier-1",
        soNumber: "SO-0001",
        status: "draft",
      },
    ]);
  });

  it("counts finalized service order actual amounts and writes aggregate totals", async () => {
    enqueueSelect("serviceOrders", [
      {
        actualAmount: 4200,
        id: "so-completed",
        quotedAmount: 5000,
        serviceProviderId: "supplier-1",
        soNumber: "SO-0002",
        status: "completed",
      },
      {
        actualAmount: 1600,
        id: "so-invoiced",
        quotedAmount: 1750,
        serviceProviderId: "supplier-2",
        soNumber: "SO-0003",
        status: "invoiced",
      },
      {
        actualAmount: 999,
        id: "so-in-progress",
        quotedAmount: 1250,
        serviceProviderId: "supplier-3",
        soNumber: "SO-0004",
        status: "in_progress",
      },
    ]);
    enqueueSelect("workOrders", [
      {
        downtimeCostPerHour: 1200,
        equipmentId: "eq-1",
      },
    ]);
    enqueueSelect("equipment", [{ downtimeCostPerHour: 1750 }]);
    enqueueSelect("costModel", [{ downtimePerHour: 2100 }]);
    enqueueSelect("workOrders", [
      {
        actualDowntimeHours: 2,
        downtimeCostPerHour: 1200,
        equipmentId: "eq-1",
        totalLaborCost: 300,
      },
    ]);
    enqueueSelect("workOrderParts", [{ totalCost: 250 }, { totalCost: 50 }]);

    const result = await aggregateProcurementCostsToWorkOrder("wo-1", "org-1");

    expect(result).toEqual({
      totalPartsCost: 6100,
      totalProcurementCost: 5800,
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({
      table: tableIds.workOrders,
      values: {
        totalCost: 8800,
        totalPartsCost: 6100,
      },
    });
  });
});
