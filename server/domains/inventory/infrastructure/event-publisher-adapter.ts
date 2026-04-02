import type { IInventoryEventPublisher, IInventoryAuditPort } from '../domain/ports.js';
import type { InventoryDomainEvent } from '../domain/events.js';
import { domainEventBus, createDomainEvent } from '../../../lib/domain-event-bus/index.js';
import type { DomainEventName } from '../../../lib/domain-event-bus/index.js';
import { recordAndPublish } from '../../../sync-events';
import { createLogger } from '../../../lib/structured-logger';

const logger = createLogger("InventoryEventPublisher");

function mapEventType(eventType: string): DomainEventName | null {
  const mapping: Record<string, DomainEventName> = {
    PartCreated: "inventory.part_created",
    PartUpdated: "inventory.part_updated",
    PartDeleted: "inventory.part_deleted",
    InventoryItemCreated: "inventory.item_created",
    InventoryItemUpdated: "inventory.item_updated",
    InventoryItemDeleted: "inventory.item_deleted",
    StockMovementRecorded: "inventory.stock_movement",
    LowStockDetected: "inventory.low_stock",
    StockReplenished: "inventory.stock_replenished",
  };
  return mapping[eventType] ?? null;
}

export class InventoryEventPublisherAdapter implements IInventoryEventPublisher, IInventoryAuditPort {
  async publish(event: InventoryDomainEvent): Promise<void> {
    const domainEventType = mapEventType(event.eventType);
    if (!domainEventType) {
      logger.warn("Unmapped inventory event type, falling back to legacy path", { eventType: event.eventType });
      await recordAndPublish("part", event.aggregateId, "update", event.payload, event.userId);
      return;
    }

    const domainEvent = createDomainEvent(
      domainEventType,
      event.orgId,
      event.payload,
      {
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        userId: event.userId,
      },
    );
    domainEventBus.emit(domainEventType, domainEvent);
  }

  async publishBatch(events: InventoryDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async recordAction(
    action: string,
    entityType: string,
    entityId: string,
    _orgId: string,
    userId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const mappedEntityType = this.mapStringToEntityType(entityType);
    await recordAndPublish(
      mappedEntityType,
      entityId,
      'update',
      { action, ...(details ?? {}) },
      userId
    );
  }

  private mapStringToEntityType(entityType: string): 'part' | 'stock' | 'inventory_movement' {
    const typeMap: Record<string, 'part' | 'stock' | 'inventory_movement'> = {
      'parts': 'part',
      'parts_inventory': 'part',
      'stock': 'stock',
      'inventory_movement': 'inventory_movement',
    };
    return typeMap[entityType] || 'part';
  }
}

export const inventoryEventPublisher = new InventoryEventPublisherAdapter();
