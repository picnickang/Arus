/**
 * MQTT Reliable Sync - Publishing
 *
 * Handles message publishing with dual-topic architecture.
 */

import type mqtt from "mqtt";
import type { MqttMessage, MqttMetrics, PublishOptions, DataChangeOperation } from "./types.js";
import { getTopicForEntity } from "./config.js";
import { enqueueMessage } from "./message-queue.js";
import { nextSeq } from "../repos/sequenceRepo";
import { incrementMqttMessagesPublished, incrementMqttPublishFailures } from "../observability";
import { logger } from "../utils/logger.js";

interface PublishContext {
  client: mqtt.MqttClient | null;
  isConnected: boolean;
  messageQueue: MqttMessage[];
  maxQueueSize: number;
  metrics: MqttMetrics;
  queueDir: string;
  qosLevel: 0 | 1 | 2;
  vesselId: string;
  emit: (event: string, data: unknown) => boolean;
}

/**
 * Publish critical data change with guaranteed delivery
 * Uses dual-topic architecture: state topic (retained) + event topic (sequenced)
 */
export async function publishDataChange(
  ctx: PublishContext,
  entityType: string,
  operation: DataChangeOperation,
  data: unknown,
  options: PublishOptions = {}
): Promise<void> {
  const baseTopic = getTopicForEntity(entityType);
  const qos = options.qos ?? ctx.qosLevel;

  // Generate atomic sequence number for event ordering
  let seq: number;
  try {
    seq = await nextSeq(ctx.vesselId, entityType);
  } catch (error) {
    logger.error("MqttReliableSync", `Failed to generate sequence for ${entityType}`, error);
    ctx.metrics.publishFailures++;
    incrementMqttPublishFailures();
    throw error;
  }

  // Build event message with sequence
  const eventMessage = {
    type: "data_change_event",
    entity: entityType,
    operation,
    data,
    seq,
    vesselId: ctx.vesselId,
    timestamp: new Date().toISOString(),
    messageId: `${ctx.vesselId}_${entityType}_${seq}`,
  };

  // Build state message (current state only)
  const stateMessage = {
    type: "data_change_state",
    entity: entityType,
    data,
    vesselId: ctx.vesselId,
    timestamp: new Date().toISOString(),
    lastSeq: seq,
  };

  // Dual-topic publishing
  const eventTopic = `${baseTopic}/events`;
  const stateTopic = `${baseTopic}/state`;

  // Serialize messages
  let eventPayload: string;
  let statePayload: string;
  try {
    eventPayload = JSON.stringify(eventMessage);
    statePayload = JSON.stringify(stateMessage);
  } catch (error) {
    logger.error("MqttReliableSync", `Failed to serialize ${operation} for ${entityType}`, error);
    ctx.metrics.publishFailures++;
    incrementMqttPublishFailures();
    throw new Error(
      `Message serialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  if (ctx.isConnected && ctx.client) {
    // Publish event (not retained, sequenced for replay)
    const eventPublish = new Promise<void>((resolve, reject) => {
      ctx.client?.publish(eventTopic, eventPayload, { qos, retain: false }, (error) => {
        if (error) {
          logger.error(
            "MqttReliableSync",
            `Failed to publish event ${operation} for ${entityType}`,
            error
          );
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Publish state (retained, latest snapshot)
    const statePublish = new Promise<void>((resolve, reject) => {
      ctx.client?.publish(stateTopic, statePayload, { qos, retain: true }, (error) => {
        if (error) {
          logger.error(
            "MqttReliableSync",
            `Failed to publish state ${operation} for ${entityType}`,
            error
          );
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Both must succeed
    try {
      await Promise.all([eventPublish, statePublish]);
      logger.info(
        "MqttReliableSync",
        `Published ${operation} for ${entityType} seq=${seq} (QoS ${qos})`
      );
      ctx.metrics.messagesPublished++;
      incrementMqttMessagesPublished(entityType, operation, qos);
      ctx.emit("message_published", {
        eventTopic,
        stateTopic,
        eventMessage,
        stateMessage,
        seq,
        qos,
      });
    } catch (error) {
      ctx.metrics.publishFailures++;
      incrementMqttPublishFailures();
      // Queue both messages for retry
      enqueueMessage(
        ctx.messageQueue,
        { topic: eventTopic, payload: eventMessage, qos, retain: false },
        ctx.maxQueueSize,
        ctx.metrics,
        ctx.queueDir,
        ctx.emit
      );
      enqueueMessage(
        ctx.messageQueue,
        { topic: stateTopic, payload: stateMessage, qos, retain: true },
        ctx.maxQueueSize,
        ctx.metrics,
        ctx.queueDir,
        ctx.emit
      );
      throw error;
    }
  } else {
    // Queue both messages for delivery when connection restored
    enqueueMessage(
      ctx.messageQueue,
      { topic: eventTopic, payload: eventMessage, qos, retain: false },
      ctx.maxQueueSize,
      ctx.metrics,
      ctx.queueDir,
      ctx.emit
    );
    enqueueMessage(
      ctx.messageQueue,
      { topic: stateTopic, payload: stateMessage, qos, retain: true },
      ctx.maxQueueSize,
      ctx.metrics,
      ctx.queueDir,
      ctx.emit
    );
    logger.debug(
      "MqttReliableSync",
      `Queued ${operation} for ${entityType} seq=${seq} (offline, queue size: ${ctx.messageQueue.length})`
    );
    ctx.emit("message_queued", { eventTopic, stateTopic, eventMessage, stateMessage, seq, qos });
  }
}
