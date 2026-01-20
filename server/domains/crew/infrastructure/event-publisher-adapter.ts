/**
 * Crew Infrastructure - Event Publisher Adapter
 * Implements ICrewEventPublisher port using sync-events and MQTT
 */

import type { ICrewEventPublisher } from "../domain/ports";
import type { CrewDomainEvent } from "../domain/events";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("CrewEventPublisher");

function mapEventToOperation(eventType: string): string {
  if (eventType.includes("CREATED")) return "create";
  if (eventType.includes("DELETED")) return "delete";
  return "update";
}

function getEntityType(event: CrewDomainEvent): string {
  switch (event.type) {
    case "CREW_MEMBER_CREATED":
    case "CREW_MEMBER_UPDATED":
    case "CREW_MEMBER_DELETED":
      return "crew";
    case "CREW_ASSIGNED":
    case "CREW_UNASSIGNED":
      return "crew_assignment";
    case "LEAVE_REQUESTED":
    case "LEAVE_APPROVED":
      return "crew_leave";
    case "CERTIFICATION_EXPIRING":
      return "crew_certification";
    default:
      return "crew";
  }
}

function getEntityId(event: CrewDomainEvent): string {
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
      const entityType = getEntityType(event);
      const entityId = getEntityId(event);
      const operation = mapEventToOperation(event.type);

      await recordAndPublish(entityType, entityId, operation, event);

      mqttReliableSync
        .publishCrewChange(operation as "create" | "update" | "delete", event)
        .catch((err) => {
          logger.error("Failed to publish crew event to MQTT", { eventType: event.type, error: err });
        });

      logger.info("Published crew domain event", { eventType: event.type });
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
