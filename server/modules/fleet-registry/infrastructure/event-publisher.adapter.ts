import type { EventPublisherPort } from "../domain/ports";
import type { Vessel } from "../domain/types";
import { recordAndPublish, type EntityType, type OperationType } from "../../../sync-events";
import { mqttReliableSync, type DataChangeOperation } from "../../../mqtt-reliable-sync";
import { logger } from "../../../utils/logger.js";

/**
 * Adapter that fans vessel-domain changes out to both the sync-events outbox
 * and MQTT reliable sync. The port speaks in plain strings to stay
 * infrastructure-agnostic; this adapter narrows them to the concrete union
 * types each transport requires.
 */
export class EventPublisherAdapter implements EventPublisherPort {
  async publish(
    entity: string,
    entityId: string,
    action: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    await recordAndPublish(entity as EntityType, entityId, action as OperationType, data, userId);
  }

  publishVesselMqtt(action: string, vessel: Vessel | { id: string }): void {
    mqttReliableSync
      .publishVesselChange(action as DataChangeOperation, vessel)
      .catch((err: unknown) => {
        logger.error("FleetRegistry", `Failed to publish vessel ${action} to MQTT`, err);
      });
  }
}
