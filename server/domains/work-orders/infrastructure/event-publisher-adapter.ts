/**
 * Work Orders Infrastructure - Event Publisher Adapter
 * Implements IWorkOrderEventPublisher port using sync-events and MQTT
 */

import type { IWorkOrderEventPublisher } from "../domain/ports";
import type { WorkOrderDomainEvent } from "../domain/events";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { createLogger } from "../../../lib/structured-logger";

const logger = createLogger("WorkOrderEventPublisher");

function mapEventToOperation(eventType: string): string {
  if (eventType.includes("CREATED")) return "create";
  if (eventType.includes("DELETED")) return "delete";
  return "update";
}

export const workOrderEventPublisher: IWorkOrderEventPublisher = {
  async publish(event: WorkOrderDomainEvent): Promise<void> {
    try {
      const entityType = "work_order";
      const entityId = event.workOrderId;
      const operation = mapEventToOperation(event.type);

      await recordAndPublish(entityType, entityId, operation, event);

      mqttReliableSync
        .publishWorkOrderChange(operation as "create" | "update" | "delete", {
          id: entityId,
          eventType: event.type,
          ...event,
        })
        .catch((err) => {
          logger.error("Failed to publish work order event to MQTT", { eventType: event.type, error: err });
        });

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
