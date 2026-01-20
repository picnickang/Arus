/**
 * Inventory Event Publisher Adapter
 * Implements IInventoryEventPublisher and IInventoryAuditPort
 */

import type { IInventoryEventPublisher, IInventoryAuditPort } from '../domain/ports.js';
import type { InventoryDomainEvent } from '../domain/events.js';
import { recordAndPublish } from '../../../sync-events';

export class InventoryEventPublisherAdapter implements IInventoryEventPublisher, IInventoryAuditPort {
  async publish(event: InventoryDomainEvent): Promise<void> {
    const entityType = this.mapAggregateToEntityType(event.aggregateType);
    const operation = this.mapEventTypeToOperation(event.eventType);
    
    await recordAndPublish(
      entityType,
      event.aggregateId,
      operation,
      event.payload,
      event.userId
    );
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

  private mapAggregateToEntityType(aggregateType: string): 'part' | 'stock' | 'inventory_movement' {
    const typeMap: Record<string, 'part' | 'stock' | 'inventory_movement'> = {
      'Part': 'part',
      'PartsInventory': 'part',
      'Stock': 'stock',
      'InventoryMovement': 'inventory_movement',
    };
    return typeMap[aggregateType] || 'part';
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

  private mapEventTypeToOperation(eventType: string): 'create' | 'update' | 'delete' {
    if (eventType.includes('Created')) return 'create';
    if (eventType.includes('Deleted')) return 'delete';
    return 'update';
  }
}

export const inventoryEventPublisher = new InventoryEventPublisherAdapter();
