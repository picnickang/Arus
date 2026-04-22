/**
 * Inventory Application Service
 * Orchestrates domain logic using injected ports
 */

import type { IPartsInventoryRepository, IInventoryEventPublisher } from "../domain/ports.js";
import type {
  PartsInventoryEntity,
  CreateInventoryItemCommand,
  UpdateInventoryItemCommand,
} from "../domain/types.js";
import {
  createEventId,
  type InventoryItemCreatedEvent,
  type InventoryItemUpdatedEvent,
  type InventoryItemDeletedEvent,
  type LowStockDetectedEvent,
} from "../domain/events.js";

export interface InventoryServiceDeps {
  partsInventoryRepository: IPartsInventoryRepository;
  eventPublisher: IInventoryEventPublisher;
}

export class InventoryApplicationService {
  constructor(private deps: InventoryServiceDeps) {}

  async listPartsInventory(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PartsInventoryEntity[]> {
    return this.deps.partsInventoryRepository.findAll(category, orgId, search, sortBy, sortOrder);
  }

  async getInventoryById(id: string, orgId: string): Promise<PartsInventoryEntity | undefined> {
    return this.deps.partsInventoryRepository.findById(id, orgId);
  }

  async getLowStockItems(orgId: string): Promise<PartsInventoryEntity[]> {
    return this.deps.partsInventoryRepository.findLowStock(orgId);
  }

  async createInventoryItem(
    command: CreateInventoryItemCommand,
    userId?: string
  ): Promise<PartsInventoryEntity> {
    const item = await this.deps.partsInventoryRepository.create(command);

    const event: InventoryItemCreatedEvent = {
      eventId: createEventId(),
      eventType: "InventoryItemCreated",
      aggregateId: item.id,
      aggregateType: "PartsInventory",
      occurredAt: new Date(),
      userId,
      orgId: command.orgId,
      version: 1,
      payload: {
        partNo: item.partNo,
        name: item.name,
        quantity: item.quantity,
        minQuantity: item.minQuantity,
        location: item.location,
      },
    };

    await this.deps.eventPublisher.publish(event);

    return item;
  }

  async updateInventoryItem(
    id: string,
    updates: UpdateInventoryItemCommand,
    orgId: string,
    userId?: string
  ): Promise<PartsInventoryEntity> {
    const previousItem = await this.deps.partsInventoryRepository.findById(id, orgId);

    if (!previousItem) {
      throw new Error(`Inventory item ${id} not found in org ${orgId}`);
    }

    const item = await this.deps.partsInventoryRepository.update(id, updates, orgId);

    const changedFields = Object.keys(updates).filter(
      (key) => updates[key as keyof UpdateInventoryItemCommand] !== undefined
    );

    const event: InventoryItemUpdatedEvent = {
      eventId: createEventId(),
      eventType: "InventoryItemUpdated",
      aggregateId: item.id,
      aggregateType: "PartsInventory",
      occurredAt: new Date(),
      userId,
      orgId,
      version: 1,
      payload: {
        changedFields,
        previousState: previousItem as unknown as Record<string, unknown>,
        newState: item as unknown as Record<string, unknown>,
      },
    };

    await this.deps.eventPublisher.publish(event);

    if (item.quantity < item.minQuantity && previousItem.quantity >= previousItem.minQuantity) {
      const lowStockEvent: LowStockDetectedEvent = {
        eventId: createEventId(),
        eventType: "LowStockDetected",
        aggregateId: item.id,
        aggregateType: "PartsInventory",
        occurredAt: new Date(),
        userId,
        orgId,
        version: 1,
        payload: {
          partNo: item.partNo,
          currentQuantity: item.quantity,
          minQuantity: item.minQuantity,
          threshold: item.minQuantity,
        },
      };

      await this.deps.eventPublisher.publish(lowStockEvent);
    }

    return item;
  }

  async deleteInventoryItem(id: string, orgId: string, userId?: string): Promise<void> {
    const item = await this.deps.partsInventoryRepository.findById(id, orgId);

    if (!item) {
      throw new Error(`Inventory item ${id} not found in org ${orgId}`);
    }

    await this.deps.partsInventoryRepository.delete(id, orgId);

    const event: InventoryItemDeletedEvent = {
      eventId: createEventId(),
      eventType: "InventoryItemDeleted",
      aggregateId: id,
      aggregateType: "PartsInventory",
      occurredAt: new Date(),
      userId,
      orgId,
      version: 1,
      payload: {
        partNo: item.partNo,
        name: item.name,
      },
    };

    await this.deps.eventPublisher.publish(event);
  }

  async adjustQuantity(
    id: string,
    newQuantity: number,
    orgId: string,
    userId?: string
  ): Promise<PartsInventoryEntity> {
    return this.updateInventoryItem(id, { quantity: newQuantity }, orgId, userId);
  }
}
