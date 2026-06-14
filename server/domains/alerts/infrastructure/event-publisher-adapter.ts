/**
 * Alerts Infrastructure - Event Publisher & Realtime Notifier
 *
 * Adapts the shared journal/outbox (`recordAndPublish`), the MQTT reliable-sync
 * bridge, and acknowledgement metrics to the alerts domain ports, so the
 * application layer depends only on the port interfaces.
 */

import type { IAlertEventPublisher, IAlertRealtimeNotifier } from "../domain/ports";
import type { AlertEntityType, AlertChangeOperation } from "../domain/events";
import type { AlertNotificationEntity } from "../domain/types";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { incrementAlertAcknowledged } from "../../../observability";
import { logger } from "../../../utils/logger.js";

export class AlertEventPublisherAdapter implements IAlertEventPublisher {
  async record(
    entityType: AlertEntityType,
    entityId: string,
    operation: AlertChangeOperation,
    payload: unknown,
    userId?: string
  ): Promise<void> {
    // "escalate" is an alerts-specific operation not present in the shared
    // OperationType union; preserve the original behaviour via a narrow cast.
    await recordAndPublish(
      entityType,
      entityId,
      operation as Parameters<typeof recordAndPublish>[2],
      payload,
      userId
    );
  }
}

export class AlertRealtimeNotifierAdapter implements IAlertRealtimeNotifier {
  publishAlertCreated(alert: AlertNotificationEntity): void {
    // Publish to MQTT for reliable sync (QoS 2 for critical alerts). Fire and
    // forget — delivery failures must not block the request path.
    mqttReliableSync.publishAlertChange("create", alert).catch((err) => {
      logger.error("AlertsRealtimeNotifier", "Failed to publish to MQTT", err);
    });
  }

  recordAcknowledged(equipmentId: string): void {
    incrementAlertAcknowledged(equipmentId);
  }
}

export const alertEventPublisher = new AlertEventPublisherAdapter();
export const alertRealtimeNotifier = new AlertRealtimeNotifierAdapter();
