/**
 * MQTT Reliable Sync - Message Queue
 *
 * In-memory message queue with size limits and persistence.
 */

import type mqtt from "mqtt";
import type { MqttMessage, MqttMetrics } from "./types.js";
import { persistQueue } from "./queue-persistence.js";
import {
  recordMqttQueueFlush,
  recordMqttQueued,
  recordMqttDropped,
  updateMqttMetrics,
} from "../observability";
import { logger } from "../utils/logger.js";

/**
 * Add message to queue with size limit enforcement
 */
export function enqueueMessage(
  queue: MqttMessage[],
  message: MqttMessage,
  maxQueueSize: number,
  metrics: MqttMetrics,
  queueDir: string,
  emit: (event: string, data: unknown) => boolean
): void {
  // Check queue size limit
  if (queue.length >= maxQueueSize) {
    // Queue full - drop oldest message to make room
    const dropped = queue.shift();
    metrics.messagesDropped++;
    recordMqttDropped();
    logger.warn("MqttReliableSync", `Queue full (${maxQueueSize}), dropped oldest message`);
    emit("message_dropped", { dropped });
  }

  queue.push(message);
  metrics.messagesQueued++;
  recordMqttQueued();

  // Persist queue asynchronously (fire and forget)
  persistQueue(queueDir, queue).catch((error) => {
    logger.error("MqttReliableSync", "Failed to persist queue after enqueue", error);
  });
}

/**
 * Flush queued messages when connection restored
 */
export async function flushMessageQueue(
  queue: MqttMessage[],
  client: mqtt.MqttClient | null,
  isConnected: boolean,
  maxQueueSize: number,
  metrics: MqttMetrics,
  emit: (event: string, data: unknown) => boolean
): Promise<void> {
  if (!client || !isConnected) {
    return;
  }

  const queueSize = queue.length;
  if (queueSize === 0) {
    return;
  }

  logger.info("MqttReliableSync", `Flushing ${queueSize} queued messages`);

  let successCount = 0;
  let failureCount = 0;

  while (queue.length > 0) {
    const message = queue.shift();
    if (message) {
      try {
        await new Promise<void>((resolve, reject) => {
          client.publish(
            message.topic,
            JSON.stringify(message.payload),
            { qos: message.qos, retain: message.retain },
            (error) => {
              if (error) {
                failureCount++;
                // Put failed message back in queue
                queue.push(message);
                reject(error);
              } else {
                successCount++;
                resolve();
              }
            }
          );
        });
      } catch (error) {
        logger.error("MqttReliableSync", "Failed to flush message", error);
      }
    }
  }

  logger.info(
    "MqttReliableSync",
    `Queue flush complete: ${successCount} sent, ${failureCount} failed`
  );

  if (successCount > 0) {
    metrics.queueFlushes++;
    recordMqttQueueFlush();
    emit("queue_flushed", { sent: successCount, failed: failureCount });
  }

  // Update queue depth metrics after flush
  updateMqttMetrics({
    currentQueueSize: queue.length,
    queueUtilization: (queue.length / maxQueueSize) * 100,
  });
}
