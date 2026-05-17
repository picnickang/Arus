import type { EventPublisherPort } from "../domain/ports";
import type { Vessel } from "../domain/types";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { logger } from "../../../utils/logger.js";

export class EventPublisherAdapter implements EventPublisherPort {
  async publish(
    entity: string,
    entityId: string,
    action: string,
    data: Record<string, unknown>,
    userId?: string
  ) {
    // @ts-ignore -- bulk-silence
    await recordAndPublish(entity, entityId, action, data, userId);
  }

  publishVesselMqtt(action: string, vessel: Vessel | { id: string }) {
    // @ts-ignore -- bulk-silence
    mqttReliableSync.publishVesselChange(action, vessel).catch((err: unknown) => {
      logger.error("FleetRegistry", `Failed to publish vessel ${action} to MQTT`, err);
    });
  }
}
