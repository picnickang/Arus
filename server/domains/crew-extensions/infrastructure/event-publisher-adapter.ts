import type { ICrewExtensionsEventPublisher, ICrewExtensionsAuditPort } from '../domain/ports.js';
import type { CrewExtensionsDomainEvent } from '../domain/events.js';
import { domainEventBus, createDomainEvent } from '../../../lib/domain-event-bus/index.js';
import { recordAndPublish } from '../../../sync-events';

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

    this.emitToUnifiedBus(event);
  }

  private emitToUnifiedBus(event: CrewExtensionsDomainEvent): void {
    switch (event.eventType) {
      case 'SimulationPreviewCreated':
        domainEventBus.emit(
          "simulation.preview.created",
          createDomainEvent("simulation.preview.created", event.orgId, {
            previewId: event.payload.previewId,
            proposedCount: event.payload.proposedCount,
            unfilledCount: event.payload.unfilledCount,
            complianceRate: event.payload.complianceRate,
            strategy: event.payload.strategy,
            dateRange: {
              start: event.payload.dateRange.from,
              end: event.payload.dateRange.to,
            },
          }, { aggregateId: event.aggregateId, aggregateType: event.aggregateType, userId: event.userId }),
        );
        break;
      case 'SimulationCommitted':
        domainEventBus.emit(
          "simulation.committed",
          createDomainEvent("simulation.committed", event.orgId, {
            previewId: event.payload.previewId,
            runId: event.payload.runId,
            assignmentsCommitted: event.payload.assignmentsCommitted,
            selectedOnly: event.payload.selectedOnly,
          }, { aggregateId: event.aggregateId, aggregateType: event.aggregateType, userId: event.userId }),
        );
        break;
      case 'SimulationDiscarded':
        domainEventBus.emit(
          "simulation.discarded",
          createDomainEvent("simulation.discarded", event.orgId, {
            previewId: event.payload.previewId,
            reason: event.payload.reason,
          }, { aggregateId: event.aggregateId, aggregateType: event.aggregateType, userId: event.userId }),
        );
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
    if (eventType.includes('Created')) {return 'create';}
    if (eventType.includes('Deleted') || eventType.includes('Cancelled')) {return 'delete';}
    return 'update';
  }
}

export const crewExtensionsEventPublisher = new CrewExtensionsEventPublisherAdapter();
