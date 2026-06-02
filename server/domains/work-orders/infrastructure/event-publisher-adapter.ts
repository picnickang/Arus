import type { IWorkOrderEventPublisher, PostCommitEmit } from "../domain/ports";
import type { WorkOrderDomainEvent } from "../domain/events";
import {
  domainEventBus,
  createDomainEvent,
  type DomainEventName,
  type DomainEventMap,
} from "../../../lib/domain-event-bus/index.js";
import {
  enqueueOutboxFromEnvelope,
  type TxOrDb,
} from "../../../lib/event-spine/outbox-repository.js";
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
          {
            workOrderId: event.workOrderId,
            changes: event.changes,
            assignmentResponse: event.assignmentResponse,
          },
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
            assignmentResponse: event.assignmentResponse,
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

function emitInProcess(built: { name: DomainEventName; envelope: DomainEventMap[DomainEventName] }) {
  try {
    domainEventBus.emit(built.name, built.envelope as DomainEventMap[DomainEventName]);
    logger.info("Published work order domain event", { eventType: built.name });
  } catch (error) {
    logger.warn("In-process bus emit failed (outbox row already persisted)", {
      eventType: built.name,
      error,
    });
  }
}

export const workOrderEventPublisher: IWorkOrderEventPublisher = {
  /**
   * Transactional-outbox publish:
   *   1) write the envelope into `event_outbox` inside the caller's
   *      `tx` (idempotent on eventId) so the outbox row commits or
   *      rolls back atomically with the business write.
   *   2) DEFER the in-process bus emit — return a thunk the caller
   *      MUST invoke after `db.transaction(...)` returns. If the
   *      transaction rolls back the thunk is never invoked, so
   *      in-process subscribers never observe an uncommitted event.
   * When called without a tx, the publisher falls back to the legacy
   * fast path: enqueue on the default connection and emit inline
   * (returns null because there is nothing to defer).
   */
  async publish(
    event: WorkOrderDomainEvent,
    tx?: unknown
  ): Promise<PostCommitEmit | null> {
    const built = envelopeFor(event);
    if (!built) return null;
    try {
      await enqueueOutboxFromEnvelope(built.envelope, tx as TxOrDb | undefined);
    } catch (error) {
      logger.error("Failed to enqueue work-order event to outbox", {
        eventType: event.type,
        error,
      });
      throw error;
    }
    if (tx === undefined) {
      // legacy path — no surrounding transaction, emit immediately.
      emitInProcess(built);
      return null;
    }
    // transactional path — emit only after caller confirms commit.
    return () => emitInProcess(built);
  },

  async publishBatch(
    events: WorkOrderDomainEvent[],
    tx?: unknown
  ): Promise<PostCommitEmit | null> {
    const deferred: PostCommitEmit[] = [];
    for (const event of events) {
      const post = await this.publish(event, tx);
      if (post) deferred.push(post);
    }
    if (deferred.length === 0) return null;
    return () => {
      for (const fn of deferred) fn();
    };
  },
};
