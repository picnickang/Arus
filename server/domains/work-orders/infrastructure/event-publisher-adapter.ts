import type { IWorkOrderEventPublisher } from "../domain/ports";
import type { WorkOrderDomainEvent } from "../domain/events";
import {
  domainEventBus,
  createDomainEvent,
  type DomainEventName,
  type DomainEventMap,
} from "../../../lib/domain-event-bus/index.js";
import { enqueueOutboxFromEnvelope } from "../../../lib/event-spine/outbox-repository.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("WorkOrderEventPublisher");

/**
 * Build the canonical `DomainEventEnvelope` for a work-order domain event.
 * Returning the envelope (instead of emitting inline like the old code)
 * lets the publisher write the envelope into the spine outbox *first*,
 * inside the caller's transaction, and only emit on the in-process bus
 * after the DB commit — this is the transactional-outbox pattern.
 */
function envelopeFor(event: WorkOrderDomainEvent): {
  name: DomainEventName;
  envelope: DomainEventMap[DomainEventName];
} | null {
  switch (event.type) {
    case "WORK_ORDER_CREATED":
      return {
        name: "work_order.created",
        envelope: createDomainEvent(
          "work_order.created",
          event.orgId,
          {
            workOrderId: event.workOrderId,
            vesselId: event.vesselId,
            equipmentId: event.equipmentId,
            priority: event.priority,
          },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    case "WORK_ORDER_UPDATED":
      return {
        name: "work_order.updated",
        envelope: createDomainEvent(
          "work_order.updated",
          event.orgId,
          { workOrderId: event.workOrderId, changes: event.changes },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    case "WORK_ORDER_STATUS_CHANGED":
      return {
        name: "work_order.status_changed",
        envelope: createDomainEvent(
          "work_order.status_changed",
          event.orgId,
          {
            workOrderId: event.workOrderId,
            previousStatus: event.previousStatus,
            newStatus: event.newStatus,
            changedBy: event.changedBy,
          },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    case "WORK_ORDER_ASSIGNED":
      return {
        name: "work_order.assigned",
        envelope: createDomainEvent(
          "work_order.assigned",
          event.orgId,
          {
            workOrderId: event.workOrderId,
            assigneeId: event.assigneeId,
            assignedBy: event.assignedBy,
          },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    case "WORK_ORDER_COMPLETED":
      return {
        name: "work_order.completed",
        envelope: createDomainEvent(
          "work_order.completed",
          event.orgId,
          {
            workOrderId: event.workOrderId,
            completedBy: event.completedBy,
            actualHours: event.actualHours,
            completionNotes: event.completionNotes,
          },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    case "WORK_ORDER_PART_ADDED":
      return {
        name: "work_order.part_added",
        envelope: createDomainEvent(
          "work_order.part_added",
          event.orgId,
          {
            workOrderId: event.workOrderId,
            partId: event.partId,
            quantity: event.quantity,
          },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    case "WORK_ORDER_TASK_COMPLETED":
      return {
        name: "work_order.task_completed",
        envelope: createDomainEvent(
          "work_order.task_completed",
          event.orgId,
          {
            workOrderId: event.workOrderId,
            taskId: event.taskId,
            completedBy: event.completedBy,
          },
          { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }
        ),
      };
    default:
      return null;
  }
}

export const workOrderEventPublisher: IWorkOrderEventPublisher = {
  /**
   * Transactional-outbox emit:
   *   1) write envelope into `event_outbox` inside the caller's `tx`
   *      (idempotent on eventId) — same transaction as the business
   *      write, so the row commits or rolls back atomically.
   *   2) AFTER the surrounding tx commits, emit on the in-process bus
   *      for legacy subscribers. The in-process emit is best-effort
   *      and never blocks the publish path.
   * When called without a tx the outbox enqueue is still durable but
   * commits on the default connection (transitional path — services
   * that need atomic semantics must pass `tx`).
   */
  async publish(event: WorkOrderDomainEvent, tx?: unknown): Promise<void> {
    const built = envelopeFor(event);
    if (!built) return;
    try {
      await enqueueOutboxFromEnvelope(
        built.envelope,
        tx as Parameters<typeof enqueueOutboxFromEnvelope>[1]
      );
    } catch (error) {
      logger.error("Failed to enqueue work-order event to outbox", {
        eventType: event.type,
        error,
      });
      throw error;
    }
    try {
      domainEventBus.emit(built.name, built.envelope as never);
      logger.info("Published work order domain event", { eventType: event.type });
    } catch (error) {
      logger.warn("In-process bus emit failed (outbox row already persisted)", {
        eventType: event.type,
        error,
      });
    }
  },

  async publishBatch(events: WorkOrderDomainEvent[], tx?: unknown): Promise<void> {
    for (const event of events) {
      await this.publish(event, tx);
    }
  },
};
