import { describe, expect, it } from "@jest/globals";
import { InventoryApplicationService } from "./inventory-service.js";
import type { IInventoryEventPublisher, IPartsInventoryRepository } from "../domain/ports.js";
import type {
  CreateInventoryItemCommand,
  PartsInventoryEntity,
  UpdateInventoryItemCommand,
} from "../domain/types.js";
import type { InventoryDomainEvent } from "../domain/events.js";

const orgId = "org-inventory";
const now = new Date("2026-06-08T12:00:00Z");

function inventoryItem(overrides: Partial<PartsInventoryEntity> = {}): PartsInventoryEntity {
  return {
    id: "inv-1",
    partNo: "FILTER-001",
    name: "Fuel filter",
    category: "Filters",
    description: "Main engine fuel filter",
    quantity: 12,
    minQuantity: 5,
    maxQuantity: 30,
    unitCost: 42,
    currency: "USD",
    location: "Stores A",
    vesselId: "vessel-1",
    equipmentId: "engine-1",
    status: "in_stock",
    orgId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function stockStatus(quantity: number, minQuantity: number): PartsInventoryEntity["status"] {
  if (quantity === 0) {
    return "out_of_stock";
  }
  if (quantity < minQuantity) {
    return "low_stock";
  }
  return "in_stock";
}

class RecordingInventoryRepository implements IPartsInventoryRepository {
  readonly items = new Map<string, PartsInventoryEntity>();
  readonly calls: string[] = [];

  constructor(initialItems: PartsInventoryEntity[] = []) {
    for (const item of initialItems) {
      this.items.set(item.id, item);
    }
  }

  async findAll(
    category?: string,
    requestedOrgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PartsInventoryEntity[]> {
    this.calls.push(
      `findAll:${category ?? ""}:${requestedOrgId ?? ""}:${search ?? ""}:${sortBy ?? ""}:${
        sortOrder ?? ""
      }`
    );
    return [...this.items.values()].filter(
      (item) =>
        (!requestedOrgId || item.orgId === requestedOrgId) &&
        (!category || item.category === category) &&
        (!search || item.name.toLowerCase().includes(search.toLowerCase()))
    );
  }

  async findById(id: string, requestedOrgId?: string): Promise<PartsInventoryEntity | undefined> {
    this.calls.push(`findById:${id}:${requestedOrgId ?? ""}`);
    const item = this.items.get(id);
    return item && (!requestedOrgId || item.orgId === requestedOrgId) ? item : undefined;
  }

  async findByPartNo(partNo: string, requestedOrgId?: string): Promise<PartsInventoryEntity[]> {
    this.calls.push(`findByPartNo:${partNo}:${requestedOrgId ?? ""}`);
    return [...this.items.values()].filter(
      (item) => item.partNo === partNo && (!requestedOrgId || item.orgId === requestedOrgId)
    );
  }

  async findLowStock(requestedOrgId: string): Promise<PartsInventoryEntity[]> {
    this.calls.push(`findLowStock:${requestedOrgId}`);
    return [...this.items.values()].filter(
      (item) => item.orgId === requestedOrgId && item.quantity < item.minQuantity
    );
  }

  async create(command: CreateInventoryItemCommand): Promise<PartsInventoryEntity> {
    this.calls.push(`create:${command.orgId}:${command.partNo}`);
    const item = inventoryItem({
      id: `inv-${this.items.size + 1}`,
      partNo: command.partNo,
      name: command.name,
      category: command.category ?? null,
      description: command.description ?? null,
      quantity: command.quantity,
      minQuantity: command.minQuantity,
      maxQuantity: command.maxQuantity ?? null,
      unitCost: command.unitCost ?? null,
      currency: command.currency ?? "USD",
      location: command.location ?? null,
      vesselId: command.vesselId ?? null,
      equipmentId: command.equipmentId ?? null,
      status: stockStatus(command.quantity, command.minQuantity),
      orgId: command.orgId,
    });
    this.items.set(item.id, item);
    return item;
  }

  async update(
    id: string,
    updates: UpdateInventoryItemCommand,
    requestedOrgId?: string
  ): Promise<PartsInventoryEntity> {
    this.calls.push(`update:${id}:${requestedOrgId ?? ""}`);
    const current = await this.findById(id, requestedOrgId);
    if (!current) {
      throw new Error(`missing item ${id}`);
    }
    const updated: PartsInventoryEntity = {
      ...current,
      ...updates,
      category: updates.category ?? current.category,
      description: updates.description ?? current.description,
      maxQuantity: updates.maxQuantity ?? current.maxQuantity,
      unitCost: updates.unitCost ?? current.unitCost,
      location: updates.location ?? current.location,
      updatedAt: new Date("2026-06-08T13:00:00Z"),
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string, requestedOrgId: string): Promise<void> {
    this.calls.push(`delete:${id}:${requestedOrgId}`);
    const current = await this.findById(id, requestedOrgId);
    if (current) {
      this.items.delete(id);
    }
  }

  async updateQuantity(
    id: string,
    newQuantity: number,
    requestedOrgId?: string
  ): Promise<PartsInventoryEntity> {
    return this.update(id, { quantity: newQuantity }, requestedOrgId);
  }
}

class RecordingInventoryPublisher implements IInventoryEventPublisher {
  readonly events: InventoryDomainEvent[] = [];

  async publish(event: InventoryDomainEvent): Promise<void> {
    this.events.push(event);
  }

  async publishBatch(events: InventoryDomainEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

function serviceWith(initialItems: PartsInventoryEntity[] = []): {
  service: InventoryApplicationService;
  repository: RecordingInventoryRepository;
  publisher: RecordingInventoryPublisher;
} {
  const repository = new RecordingInventoryRepository(initialItems);
  const publisher = new RecordingInventoryPublisher();
  return {
    service: new InventoryApplicationService({
      partsInventoryRepository: repository,
      eventPublisher: publisher,
    }),
    repository,
    publisher,
  };
}

describe("InventoryApplicationService", () => {
  it("delegates read queries with org, search, category, and sort context intact", async () => {
    const low = inventoryItem({ id: "low", quantity: 2, minQuantity: 5 });
    const otherOrg = inventoryItem({ id: "other", orgId: "org-other", quantity: 1 });
    const { service, repository } = serviceWith([low, otherOrg]);

    await expect(
      service.listPartsInventory("Filters", orgId, "filter", "name", "asc")
    ).resolves.toEqual([low]);
    await expect(service.getInventoryById("low", orgId)).resolves.toEqual(low);
    await expect(service.getInventoryById("other", orgId)).resolves.toBeUndefined();
    await expect(service.getLowStockItems(orgId)).resolves.toEqual([low]);

    expect(repository.calls).toEqual(
      expect.arrayContaining([
        "findAll:Filters:org-inventory:filter:name:asc",
        "findById:low:org-inventory",
        "findById:other:org-inventory",
        "findLowStock:org-inventory",
      ])
    );
  });

  it("publishes a creation event with operational stock metadata", async () => {
    const { service, publisher } = serviceWith();

    const item = await service.createInventoryItem(
      {
        orgId,
        partNo: "PUMP-SEAL",
        name: "Pump seal kit",
        quantity: 4,
        minQuantity: 10,
        location: "Locker 2",
      },
      "storekeeper-1"
    );

    expect(item).toMatchObject({ partNo: "PUMP-SEAL", status: "low_stock" });
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      eventType: "InventoryItemCreated",
      aggregateId: item.id,
      orgId,
      userId: "storekeeper-1",
      payload: {
        partNo: "PUMP-SEAL",
        name: "Pump seal kit",
        quantity: 4,
        minQuantity: 10,
        location: "Locker 2",
      },
    });
  });

  it("publishes update and low-stock events only when crossing the threshold", async () => {
    const item = inventoryItem({ quantity: 12, minQuantity: 5 });
    const { service, publisher } = serviceWith([item]);

    const updated = await service.updateInventoryItem(
      item.id,
      { quantity: 3, location: "Engine room" },
      orgId,
      "chief-engineer"
    );

    expect(updated).toMatchObject({ quantity: 3, location: "Engine room" });
    expect(publisher.events.map((event) => event.eventType)).toEqual([
      "InventoryItemUpdated",
      "LowStockDetected",
    ]);
    expect(publisher.events[0]).toMatchObject({
      eventType: "InventoryItemUpdated",
      orgId,
      userId: "chief-engineer",
      payload: { changedFields: ["quantity", "location"] },
    });
    expect(publisher.events[1]).toMatchObject({
      eventType: "LowStockDetected",
      payload: {
        partNo: "FILTER-001",
        currentQuantity: 3,
        minQuantity: 5,
        threshold: 5,
      },
    });
  });

  it("does not duplicate low-stock events when an item was already below minimum", async () => {
    const item = inventoryItem({ quantity: 2, minQuantity: 5 });
    const { service, publisher } = serviceWith([item]);

    await service.adjustQuantity(item.id, 1, orgId, "storekeeper-2");

    expect(publisher.events.map((event) => event.eventType)).toEqual(["InventoryItemUpdated"]);
  });

  it("fails update/delete for missing org-scoped inventory and leaves events untouched", async () => {
    const item = inventoryItem({ orgId: "org-other" });
    const { service, publisher } = serviceWith([item]);

    await expect(service.updateInventoryItem(item.id, { quantity: 9 }, orgId)).rejects.toThrow(
      "Inventory item inv-1 not found in org org-inventory"
    );
    await expect(service.deleteInventoryItem(item.id, orgId)).rejects.toThrow(
      "Inventory item inv-1 not found in org org-inventory"
    );
    expect(publisher.events).toHaveLength(0);
  });

  it("deletes org-scoped inventory and publishes an audit event", async () => {
    const item = inventoryItem();
    const { service, repository, publisher } = serviceWith([item]);

    await service.deleteInventoryItem(item.id, orgId, "admin-1");

    expect(repository.items.has(item.id)).toBe(false);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      eventType: "InventoryItemDeleted",
      aggregateId: item.id,
      orgId,
      userId: "admin-1",
      payload: { partNo: item.partNo, name: item.name },
    });
  });
});
