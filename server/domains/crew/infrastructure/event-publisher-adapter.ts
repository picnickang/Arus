import type { ICrewEventPublisher } from "../domain/ports";
import type { CrewDomainEvent } from "../domain/events";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("CrewEventPublisher");

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
  }
}

function emitTypedEvent(event: CrewDomainEvent): void {
  switch (event.type) {
    case "CREW_MEMBER_CREATED":
      domainEventBus.emit(
        "crew.member_created",
        createDomainEvent(
          "crew.member_created",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            vesselId: event.vesselId,
          },
          { aggregateId: event.crewMemberId, aggregateType: "Crew" }
        )
      );
      break;
    case "CREW_MEMBER_UPDATED":
      domainEventBus.emit(
        "crew.member_updated",
        createDomainEvent(
          "crew.member_updated",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            changes: event.changes,
          },
          { aggregateId: event.crewMemberId, aggregateType: "Crew" }
        )
      );
      break;
    case "CREW_MEMBER_DELETED":
      domainEventBus.emit(
        "crew.member_deleted",
        createDomainEvent(
          "crew.member_deleted",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
          },
          { aggregateId: event.crewMemberId, aggregateType: "Crew" }
        )
      );
      break;
    case "CREW_ASSIGNED":
      domainEventBus.emit(
        "crew.assigned",
        createDomainEvent(
          "crew.assigned",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            vesselId: event.vesselId,
            assignmentId: event.assignmentId,
            startDate: event.startDate,
            endDate: event.endDate,
          },
          { aggregateId: event.assignmentId, aggregateType: "CrewAssignment" }
        )
      );
      break;
    case "CREW_UNASSIGNED":
      domainEventBus.emit(
        "crew.unassigned",
        createDomainEvent(
          "crew.unassigned",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            vesselId: event.vesselId,
            assignmentId: event.assignmentId,
          },
          { aggregateId: event.assignmentId, aggregateType: "CrewAssignment" }
        )
      );
      break;
    case "LEAVE_REQUESTED":
      domainEventBus.emit(
        "crew.leave_requested",
        createDomainEvent(
          "crew.leave_requested",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            leaveId: event.leaveId,
            startDate: event.startDate,
            endDate: event.endDate,
            leaveType: event.leaveType,
          },
          { aggregateId: event.leaveId, aggregateType: "Leave" }
        )
      );
      break;
    case "LEAVE_APPROVED":
      domainEventBus.emit(
        "crew.leave_approved",
        createDomainEvent(
          "crew.leave_approved",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            leaveId: event.leaveId,
            approvedBy: event.approvedBy,
          },
          { aggregateId: event.leaveId, aggregateType: "Leave" }
        )
      );
      break;
    case "CERTIFICATION_EXPIRING":
      domainEventBus.emit(
        "crew.certification_expiring",
        createDomainEvent(
          "crew.certification_expiring",
          event.orgId,
          {
            crewMemberId: event.crewMemberId,
            certificationId: event.certificationId,
            expiryDate: event.expiryDate,
            daysRemaining: event.daysRemaining,
          },
          { aggregateId: event.certificationId, aggregateType: "Certification" }
        )
      );
      break;
  }
}

export const crewEventPublisher: ICrewEventPublisher = {
  async publish(event: CrewDomainEvent): Promise<void> {
    try {
      emitTypedEvent(event);
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
