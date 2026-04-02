import type { IWorkOrderEventPublisher } from "../domain/ports";
import type { WorkOrderDomainEvent } from "../domain/events";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("WorkOrderEventPublisher");

function emitTypedEvent(event: WorkOrderDomainEvent): void {
  switch (event.type) {
    case "WORK_ORDER_CREATED":
      domainEventBus.emit("work_order.created", createDomainEvent("work_order.created", event.orgId, {
        workOrderId: event.workOrderId, vesselId: event.vesselId, equipmentId: event.equipmentId, priority: event.priority,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
    case "WORK_ORDER_UPDATED":
      domainEventBus.emit("work_order.updated", createDomainEvent("work_order.updated", event.orgId, {
        workOrderId: event.workOrderId, changes: event.changes,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
    case "WORK_ORDER_STATUS_CHANGED":
      domainEventBus.emit("work_order.status_changed", createDomainEvent("work_order.status_changed", event.orgId, {
        workOrderId: event.workOrderId, previousStatus: event.previousStatus, newStatus: event.newStatus, changedBy: event.changedBy,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
    case "WORK_ORDER_ASSIGNED":
      domainEventBus.emit("work_order.assigned", createDomainEvent("work_order.assigned", event.orgId, {
        workOrderId: event.workOrderId, assigneeId: event.assigneeId, assignedBy: event.assignedBy,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
    case "WORK_ORDER_COMPLETED":
      domainEventBus.emit("work_order.completed", createDomainEvent("work_order.completed", event.orgId, {
        workOrderId: event.workOrderId, completedBy: event.completedBy, actualHours: event.actualHours, completionNotes: event.completionNotes,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
    case "WORK_ORDER_PART_ADDED":
      domainEventBus.emit("work_order.part_added", createDomainEvent("work_order.part_added", event.orgId, {
        workOrderId: event.workOrderId, partId: event.partId, quantity: event.quantity,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
    case "WORK_ORDER_TASK_COMPLETED":
      domainEventBus.emit("work_order.task_completed", createDomainEvent("work_order.task_completed", event.orgId, {
        workOrderId: event.workOrderId, taskId: event.taskId, completedBy: event.completedBy,
      }, { aggregateId: event.workOrderId, aggregateType: "WorkOrder" }));
      break;
  }
}

export const workOrderEventPublisher: IWorkOrderEventPublisher = {
  async publish(event: WorkOrderDomainEvent): Promise<void> {
    try {
      emitTypedEvent(event);
      logger.info("Published work order domain event", { eventType: event.type });
    } catch (error) {
      logger.error("Failed to publish work order domain event", { eventType: event.type, error });
      throw error;
    }
  },

  async publishBatch(events: WorkOrderDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  },
};
