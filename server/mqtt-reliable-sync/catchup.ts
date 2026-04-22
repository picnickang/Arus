/**
 * MQTT Reliable Sync - Catchup
 *
 * Handles catchup message publishing for reconnecting clients.
 */

import type mqtt from "mqtt";
import { db } from "../db";
import {
  workOrders,
  alertNotifications,
  equipment,
  crew,
  maintenanceSchedules,
} from "@shared/schema-runtime";
import { gte } from "drizzle-orm";
import { getTopicForEntity } from "./config.js";
import { logger } from "../utils/logger.js";

/**
 * Publish catchup messages for a specific entity
 * Called when a client reconnects after being offline
 */
export async function publishCatchupMessages(
  client: mqtt.MqttClient | null,
  isConnected: boolean,
  entityType: string,
  since: Date,
  limit: number,
  emit: (event: string, data: any) => boolean
): Promise<void> {
  logger.info(
    "MqttReliableSync",
    `Publishing catchup for ${entityType} since ${since.toISOString()}`
  );

  try {
    const entityQueries: Record<string, () => Promise<any[]>> = {
      work_orders: () =>
        db.select().from(workOrders).where(gte(workOrders.updatedAt, since)).limit(limit),
      alerts: () =>
        db
          .select()
          .from(alertNotifications)
          .where(gte(alertNotifications.createdAt, since))
          .limit(limit),
      equipment: () =>
        db.select().from(equipment).where(gte(equipment.updatedAt, since)).limit(limit),
      crew: () => db.select().from(crew).where(gte(crew.updatedAt, since)).limit(limit),
      maintenance_schedules: () =>
        db
          .select()
          .from(maintenanceSchedules)
          .where(gte(maintenanceSchedules.updatedAt, since))
          .limit(limit),
      maintenance: () =>
        db
          .select()
          .from(maintenanceSchedules)
          .where(gte(maintenanceSchedules.updatedAt, since))
          .limit(limit),
    };

    const queryFn = entityQueries[entityType];
    if (!queryFn) {
      logger.warn("MqttReliableSync", `Unknown entity type for catchup: ${entityType}`);
      return;
    }
    const changes = await queryFn();

    logger.debug("MqttReliableSync", `Found ${changes.length} changes for ${entityType}`);

    // Publish each change to catchup topic
    const catchupTopic = `${getTopicForEntity(entityType)}/catchup`;

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const message = {
        type: "catchup",
        entity: entityType,
        operation: "update",
        data: change,
        timestamp: new Date().toISOString(),
        messageId: `catchup_${Date.now()}_${i}`,
        sequence: i,
        total: changes.length,
      };

      if (client && isConnected) {
        await new Promise<void>((resolve, reject) => {
          client.publish(
            catchupTopic,
            JSON.stringify(message),
            { qos: 1, retain: false },
            (error) => {
              if (error) {
                logger.error(
                  "MqttReliableSync",
                  `Failed to publish catchup message ${i + 1}/${changes.length}`,
                  error
                );
                reject(error);
              } else {
                resolve();
              }
            }
          );
        });
      }
    }

    logger.info(
      "MqttReliableSync",
      `Published ${changes.length} catchup messages for ${entityType}`
    );
    emit("catchup_published", { entityType, since, limit, count: changes.length });
  } catch (error) {
    logger.error("MqttReliableSync", `Failed to publish catchup for ${entityType}`, error);
    throw error;
  }
}
