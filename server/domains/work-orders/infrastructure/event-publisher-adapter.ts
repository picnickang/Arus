import type { IWorkOrderEventPublisher } from "../domain/ports";
import type { WorkOrderDomainEvent } from "../domain/events";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import type { DomainEventName } from "../../../lib/domain-event-bus/index.js";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("WorkOrderEventPublisher");

function mapEventType(event: WorkOrderDomainEvent): DomainEventName | null {
  switch (event.type) {
    case "WORK_ORDER_CREATED": return "work_order.created";
    case "WORK_ORDER_UPDATED": return "work_order.updated";
    case "WORK_ORDER_STATUS_CHANGED": return "work_order.status_changed";
    case "WORK_ORDER_ASSIGNED": return "work_order.assigned";
    case "WORK_ORDER_COMPLETED": return "work_order.completed";
    case "WORK_ORDER_PART_ADDED": return "work_order.part_added";
    case "WORK_ORDER_TASK_COMPLETED": return "work_order.task_completed";
    default: return null;
  }
}

function extractPayload(event: WorkOrderDomainEvent): Record<string, unknown> {
  const { type: _type, timestamp: _ts, ...rest } = event;
  return rest;
}

export const workOrderEventPublisher: IWorkOrderEventPublisher = {
  async publish(event: WorkOrderDomainEvent): Promise<void> {
    try {
      const eventType = mapEventType(event);
      if (!eventType) {
        logger.warn("Unknown work order event type", { eventType: event.type });
        return;
      }

      const orgId = (event as Record<string, unknown>).orgId as string;
      if (!orgId) {
        logger.warn("Work order event missing orgId, skipping unified bus emit", { eventType: event.type });
        return;
      }
      const domainEvent = createDomainEvent(
        eventType,
        orgId,
        extractPayload(event),
        { aggregateId: event.workOrderId, aggregateType: "WorkOrder" },
      );
      domainEventBus.emit(eventType, domainEvent);

      logger.info("Published work order domain event via unified bus", { eventType: event.type });
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
