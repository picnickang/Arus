import type { ICrewEventPublisher } from "../domain/ports";
import type {
  CrewDomainEvent,
  CrewMemberCreated,
  CrewMemberUpdated,
  CrewMemberDeleted,
  CrewAssigned,
  CrewUnassigned,
  LeaveRequested,
  LeaveApproved,
  CertificationExpiring,
} from "../domain/events";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync/index.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("CrewEventPublisher");

function mapEventToOperation(eventType: string): "create" | "update" | "delete" {
  if (eventType.includes("CREATED") || eventType.includes("ASSIGNED") || eventType.includes("REQUESTED")) return "create";
  if (eventType.includes("DELETED") || eventType.includes("UNASSIGNED")) return "delete";
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

function emitTypedEvent(event: CrewDomainEvent): boolean {
  switch (event.type) {
    case "CREW_MEMBER_CREATED": {
      const e = event as CrewMemberCreated;
      if (!e.orgId) return false;
      domainEventBus.emit("crew.member_created", createDomainEvent("crew.member_created", e.orgId, {
        crewMemberId: e.crewMemberId, vesselId: e.vesselId,
      }, { aggregateId: e.crewMemberId, aggregateType: "Crew" }));
      return true;
    }
    case "CREW_MEMBER_UPDATED": {
      const e = event as CrewMemberUpdated;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.member_updated", createDomainEvent("crew.member_updated", orgId, {
        crewMemberId: e.crewMemberId, changes: e.changes,
      }, { aggregateId: e.crewMemberId, aggregateType: "Crew" }));
      return true;
    }
    case "CREW_MEMBER_DELETED": {
      const e = event as CrewMemberDeleted;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.member_deleted", createDomainEvent("crew.member_deleted", orgId, {
        crewMemberId: e.crewMemberId,
      }, { aggregateId: e.crewMemberId, aggregateType: "Crew" }));
      return true;
    }
    case "CREW_ASSIGNED": {
      const e = event as CrewAssigned;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.assigned", createDomainEvent("crew.assigned", orgId, {
        crewMemberId: e.crewMemberId, vesselId: e.vesselId, assignmentId: e.assignmentId,
        startDate: e.startDate, endDate: e.endDate,
      }, { aggregateId: e.assignmentId, aggregateType: "CrewAssignment" }));
      return true;
    }
    case "CREW_UNASSIGNED": {
      const e = event as CrewUnassigned;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.unassigned", createDomainEvent("crew.unassigned", orgId, {
        crewMemberId: e.crewMemberId, vesselId: e.vesselId, assignmentId: e.assignmentId,
      }, { aggregateId: e.assignmentId, aggregateType: "CrewAssignment" }));
      return true;
    }
    case "LEAVE_REQUESTED": {
      const e = event as LeaveRequested;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.leave_requested", createDomainEvent("crew.leave_requested", orgId, {
        crewMemberId: e.crewMemberId, leaveId: e.leaveId, startDate: e.startDate,
        endDate: e.endDate, leaveType: e.leaveType,
      }, { aggregateId: e.leaveId, aggregateType: "Leave" }));
      return true;
    }
    case "LEAVE_APPROVED": {
      const e = event as LeaveApproved;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.leave_approved", createDomainEvent("crew.leave_approved", orgId, {
        crewMemberId: e.crewMemberId, leaveId: e.leaveId, approvedBy: e.approvedBy,
      }, { aggregateId: e.leaveId, aggregateType: "Leave" }));
      return true;
    }
    case "CERTIFICATION_EXPIRING": {
      const e = event as CertificationExpiring;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("crew.certification_expiring", createDomainEvent("crew.certification_expiring", orgId, {
        crewMemberId: e.crewMemberId, certificationId: e.certificationId,
        expiryDate: e.expiryDate, daysRemaining: e.daysRemaining,
      }, { aggregateId: e.certificationId, aggregateType: "Certification" }));
      return true;
    }
    default:
      return false;
  }
}

export const crewEventPublisher: ICrewEventPublisher = {
  async publish(event: CrewDomainEvent): Promise<void> {
    try {
      const emitted = emitTypedEvent(event);

      if (!emitted) {
        const entityType = getEntityType(event);
        const entityId = getEntityId(event);
        const operation = mapEventToOperation(event.type);
        await recordAndPublish(entityType, entityId, operation, event);
        mqttReliableSync
          .publishCrewChange(operation, event)
          .catch((err) => {
            logger.error("Failed to publish crew event to MQTT", { eventType: event.type, error: err });
          });
      }

      logger.info("Published crew domain event", { eventType: event.type, unifiedBus: emitted });
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
