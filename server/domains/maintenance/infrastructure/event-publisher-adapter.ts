/**
 * Maintenance Infrastructure - Event Publisher Adapter
 * Implements IEventPublisher port using sync-events and MQTT
 */

import type { IEventPublisher, IRealtimeSyncPort, IAuditPort } from '../domain/ports';
import type { MaintenanceDomainEvent } from '../domain/events';
import { recordAndPublish } from '../../../sync-events';
import { mqttReliableSync } from '../../../mqtt-reliable-sync';
import { logger } from '../../../utils/logger.js';

/**
 * Adapter that publishes domain events to outbox + MQTT
 */
export class EventPublisherAdapter implements IEventPublisher {
  async publish(event: MaintenanceDomainEvent): Promise<void> {
    const entityType = event.aggregateType === 'MaintenanceSchedule' 
      ? 'maintenance_schedule' 
      : 'maintenance_template';
    
    const operation = this.mapEventToOperation(event.eventType);
    
    await recordAndPublish(
      entityType,
      event.aggregateId,
      operation,
      event.payload,
      event.userId
    );
    
    mqttReliableSync
      .publishMaintenanceChange(operation as 'create' | 'update' | 'delete', {
        id: event.aggregateId,
        eventType: event.eventType,
        ...event.payload,
      })
      .catch((err) => {
        logger.error('EventPublisherAdapter', `Failed to publish ${event.eventType} to MQTT`, err);
      });
  }

  async publishBatch(events: MaintenanceDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  private mapEventToOperation(eventType: string): string {
    if (eventType.includes('Created') || eventType.includes('AutoScheduled')) {
      return 'create';
    }
    if (eventType.includes('Updated') || eventType.includes('Completed') || eventType.includes('Overdue')) {
      return 'update';
    }
    if (eventType.includes('Deleted')) {
      return 'delete';
    }
    return 'update';
  }
}

/**
 * Adapter for real-time sync via MQTT
 */
export class RealtimeSyncAdapter implements IRealtimeSyncPort {
  async publishChange(params: {
    entityType: string;
    operation: 'create' | 'update' | 'delete';
    entityId: string;
    payload: unknown;
  }): Promise<void> {
    const data = { id: params.entityId, ...(params.payload as object) };
    await mqttReliableSync.publishMaintenanceChange(params.operation, data);
  }
}

/**
 * Adapter for audit trail
 */
export class AuditAdapter implements IAuditPort {
  async record(params: {
    entityType: string;
    entityId: string;
    operation: string;
    payload: unknown;
    userId?: string;
  }): Promise<void> {
    await recordAndPublish(
      params.entityType,
      params.entityId,
      params.operation,
      params.payload,
      params.userId
    );
  }
}

export const eventPublisher = new EventPublisherAdapter();
export const realtimeSync = new RealtimeSyncAdapter();
export const auditAdapter = new AuditAdapter();
