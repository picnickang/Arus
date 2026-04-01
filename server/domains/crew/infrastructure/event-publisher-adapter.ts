import type { ICrewEventPublisher } from "../domain/ports";
import type { CrewDomainEvent } from "../domain/events";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import type { DomainEventName } from "../../../lib/domain-event-bus/index.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("CrewEventPublisher");

function mapEventType(event: CrewDomainEvent): DomainEventName | null {
  switch (event.type) {
    case "CREW_MEMBER_CREATED": return "crew.member_created";
    case "CREW_MEMBER_UPDATED": return "crew.member_updated";
    case "CREW_MEMBER_DELETED": return "crew.member_deleted";
    case "CREW_ASSIGNED": return "crew.assigned";
    case "CREW_UNASSIGNED": return "crew.unassigned";
    case "LEAVE_REQUESTED": return "crew.leave_requested";
    case "LEAVE_APPROVED": return "crew.leave_approved";
    case "CERTIFICATION_EXPIRING": return "crew.certification_expiring";
    default: return null;
  }
}

function extractPayload(event: CrewDomainEvent): Record<string, unknown> {
  const { type: _type, timestamp: _ts, ...rest } = event;
  return rest;
}

function getAggregateId(event: CrewDomainEvent): string {
  switch (event.type) {
    case "CREW_MEMBER_CREATED":
    case "CREW_MEMBER_UPDATED":
    case "CREW_MEMBER_DELETED":
      return event.crewMemberId;
    case "CREW_ASSIGNED":
    case "CREW_UNASSIGNED":
      return event.assignmentId;
    case "LEAVE_REQUESTED":
    case "LEAVE_APPROVED":
      return event.leaveId;
    case "CERTIFICATION_EXPIRING":
      return event.certificationId;
    default:
      return "unknown";
  }
}

export const crewEventPublisher: ICrewEventPublisher = {
  async publish(event: CrewDomainEvent): Promise<void> {
    try {
      const eventType = mapEventType(event);
      if (!eventType) {
        logger.warn("Unknown crew event type", { eventType: event.type });
        return;
      }

      const orgId = (event as Record<string, unknown>).orgId as string;
      if (!orgId) {
        logger.warn("Crew event missing orgId, skipping unified bus emit", { eventType: event.type });
        return;
      }
      const domainEvent = createDomainEvent(
        eventType,
        orgId,
        extractPayload(event),
        { aggregateId: getAggregateId(event), aggregateType: "Crew" },
      );
      domainEventBus.emit(eventType, domainEvent);

      logger.info("Published crew domain event via unified bus", { eventType: event.type });
    } catch (error) {
      logger.error("Failed to publish crew domain event", { eventType: event.type, error });
      throw error;
    }
  },

  async publishBatch(events: CrewDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  },
};
