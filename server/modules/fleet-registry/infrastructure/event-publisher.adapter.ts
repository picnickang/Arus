import type { EventPublisherPort } from "../domain/ports";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { logger } from "../../../utils/logger.js";

export class EventPublisherAdapter implements EventPublisherPort {
  async publish(entity: string, entityId: string, action: string, data: any, userId?: string) {
    await recordAndPublish(entity, entityId, action, data, userId);
  }

  publishVesselMqtt(action: string, vessel: any) {
    mqttReliableSync.publishVesselChange(action, vessel).catch((err: any) => {
      logger.error("FleetRegistry", `Failed to publish vessel ${action} to MQTT`, err);
    });
  }
}
