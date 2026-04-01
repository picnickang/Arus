import type { IWorkOrderEventPublisher } from "../domain/ports";
import type {
  WorkOrderDomainEvent,
  WorkOrderCreated,
  WorkOrderUpdated,
  WorkOrderStatusChanged,
  WorkOrderAssigned,
  WorkOrderCompleted,
  WorkOrderPartAdded,
  WorkOrderTaskCompleted,
} from "../domain/events";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync/index.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("WorkOrderEventPublisher");

function mapEventToOperation(eventType: string): "create" | "update" | "delete" {
  if (eventType.includes("CREATED")) return "create";
  if (eventType.includes("DELETED")) return "delete";
  return "update";
}

function emitTypedEvent(event: WorkOrderDomainEvent): boolean {
  switch (event.type) {
    case "WORK_ORDER_CREATED": {
      const e = event as WorkOrderCreated;
      if (!e.orgId) return false;
      domainEventBus.emit("work_order.created", createDomainEvent("work_order.created", e.orgId, {
        workOrderId: e.workOrderId, vesselId: e.vesselId, equipmentId: e.equipmentId, priority: e.priority,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    case "WORK_ORDER_UPDATED": {
      const e = event as WorkOrderUpdated;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("work_order.updated", createDomainEvent("work_order.updated", orgId, {
        workOrderId: e.workOrderId, changes: e.changes,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    case "WORK_ORDER_STATUS_CHANGED": {
      const e = event as WorkOrderStatusChanged;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("work_order.status_changed", createDomainEvent("work_order.status_changed", orgId, {
        workOrderId: e.workOrderId, previousStatus: e.previousStatus, newStatus: e.newStatus, changedBy: e.changedBy,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    case "WORK_ORDER_ASSIGNED": {
      const e = event as WorkOrderAssigned;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("work_order.assigned", createDomainEvent("work_order.assigned", orgId, {
        workOrderId: e.workOrderId, assigneeId: e.assigneeId, assignedBy: e.assignedBy,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    case "WORK_ORDER_COMPLETED": {
      const e = event as WorkOrderCompleted;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("work_order.completed", createDomainEvent("work_order.completed", orgId, {
        workOrderId: e.workOrderId, completedBy: e.completedBy, actualHours: e.actualHours, completionNotes: e.completionNotes,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    case "WORK_ORDER_PART_ADDED": {
      const e = event as WorkOrderPartAdded;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("work_order.part_added", createDomainEvent("work_order.part_added", orgId, {
        workOrderId: e.workOrderId, partId: e.partId, quantity: e.quantity,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    case "WORK_ORDER_TASK_COMPLETED": {
      const e = event as WorkOrderTaskCompleted;
      const orgId = (e as Record<string, unknown>).orgId as string | undefined;
      if (!orgId) return false;
      domainEventBus.emit("work_order.task_completed", createDomainEvent("work_order.task_completed", orgId, {
        workOrderId: e.workOrderId, taskId: e.taskId, completedBy: e.completedBy,
      }, { aggregateId: e.workOrderId, aggregateType: "WorkOrder" }));
      return true;
    }
    default:
      return false;
  }
}

export const workOrderEventPublisher: IWorkOrderEventPublisher = {
  async publish(event: WorkOrderDomainEvent): Promise<void> {
    try {
      const emitted = emitTypedEvent(event);

      if (!emitted) {
        const operation = mapEventToOperation(event.type);
        await recordAndPublish("work_order", event.workOrderId, operation, event);
        mqttReliableSync
          .publishWorkOrderChange(operation, { id: event.workOrderId, eventType: event.type, ...event })
          .catch((err) => {
            logger.error("Failed to publish work order event to MQTT", { eventType: event.type, error: err });
          });
      }

      logger.info("Published work order domain event", { eventType: event.type, unifiedBus: emitted });
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
