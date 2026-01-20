/**
 * Crew Extensions Event Publisher Adapter
 * Implements ICrewExtensionsEventPublisher and ICrewExtensionsAuditPort
 */

import type { ICrewExtensionsEventPublisher, ICrewExtensionsAuditPort } from '../domain/ports.js';
import type { CrewExtensionsDomainEvent } from '../domain/events.js';
import { recordAndPublish } from '../../../sync-events';
import { schedulerEventBus } from '../../../events/scheduler-bus.js';

export class CrewExtensionsEventPublisherAdapter implements ICrewExtensionsEventPublisher, ICrewExtensionsAuditPort {
  async publish(event: CrewExtensionsDomainEvent): Promise<void> {
    const entityType = this.mapAggregateToEntityType(event.aggregateType);
    const operation = this.mapEventTypeToOperation(event.eventType);
    
    await recordAndPublish(
      entityType,
      event.aggregateId,
      operation,
      event.payload,
      event.userId
    );

    this.emitToSchedulerBus(event);
  }

  private emitToSchedulerBus(event: CrewExtensionsDomainEvent): void {
    switch (event.eventType) {
      case 'SimulationPreviewCreated':
        schedulerEventBus.emitSimulationPreviewCreated({
          orgId: event.orgId,
          previewId: event.payload.previewId,
          proposedCount: event.payload.proposedCount,
          unfilledCount: event.payload.unfilledCount,
          complianceRate: event.payload.complianceRate,
          strategy: event.payload.strategy,
          dateRange: {
            start: event.payload.dateRange.from,
            end: event.payload.dateRange.to,
          },
        });
        break;
      case 'SimulationCommitted':
        schedulerEventBus.emitSimulationCommitted({
          orgId: event.orgId,
          previewId: event.payload.previewId,
          runId: event.payload.runId,
          assignmentsCommitted: event.payload.assignmentsCommitted,
          selectedOnly: event.payload.selectedOnly,
        });
        break;
      case 'SimulationDiscarded':
        schedulerEventBus.emitSimulationDiscarded({
          orgId: event.orgId,
          previewId: event.payload.previewId,
          reason: event.payload.reason,
        });
        break;
    }
  }

  async publishBatch(events: CrewExtensionsDomainEvent[]): Promise<void> {
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

  private mapAggregateToEntityType(aggregateType: string): 'crew_assignment' | 'crew' | 'vessel' {
    const typeMap: Record<string, 'crew_assignment' | 'crew' | 'vessel'> = {
      'SchedulerRun': 'crew_assignment',
      'Assignment': 'crew_assignment',
      'CrewMember': 'crew',
    };
    return typeMap[aggregateType] || 'crew_assignment';
  }

  private mapStringToEntityType(entityType: string): 'crew_assignment' | 'crew' | 'vessel' {
    const typeMap: Record<string, 'crew_assignment' | 'crew' | 'vessel'> = {
      'scheduler_run': 'crew_assignment',
      'assignment': 'crew_assignment',
      'crew_member': 'crew',
    };
    return typeMap[entityType] || 'crew_assignment';
  }

  private mapEventTypeToOperation(eventType: string): 'create' | 'update' | 'delete' {
    if (eventType.includes('Created')) return 'create';
    if (eventType.includes('Deleted') || eventType.includes('Cancelled')) return 'delete';
    return 'update';
  }
}

export const crewExtensionsEventPublisher = new CrewExtensionsEventPublisherAdapter();
