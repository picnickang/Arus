/**
 * MQTT Reliable Sync - Subscription
 *
 * Handles topic subscriptions and unsubscriptions.
 */

import type mqtt from "mqtt";
import { getTopicForEntity } from "./config.js";
import { logger } from "../utils/logger.js";

/**
 * Subscribe to entity changes with dual-topic architecture
 */
export async function subscribeToEntity(
  client: mqtt.MqttClient | null,
  isConnected: boolean,
  subscriptions: Map<string, Set<(payload: any) => void>>,
  entityType: string,
  callback: (payload: any) => void,
  enableCatchup: boolean = true
): Promise<void> {
  const baseTopic = getTopicForEntity(entityType);
  const stateTopic = `${baseTopic}/state`;
  const eventTopic = `${baseTopic}/events`;

  const topicsToSubscribe = [stateTopic, eventTopic];

  if (enableCatchup) {
    const catchupTopic = `${baseTopic}/catchup`;
    topicsToSubscribe.push(catchupTopic);
  }

  // Register callback for all topics
  for (const topic of topicsToSubscribe) {
    if (!subscriptions.has(topic)) {
      subscriptions.set(topic, new Set());
    }
    subscriptions.get(topic)!.add(callback);
  }

  if (client && isConnected) {
    const subscribePromises: Promise<void>[] = [];

    subscribePromises.push(
      new Promise<void>((resolve, reject) => {
        client.subscribe(stateTopic, { qos: 1 }, (error) => {
          if (error) {
            logger.error("MqttReliableSync", `Failed to subscribe to ${entityType} state`, error);
            reject(error);
          } else {
            logger.debug("MqttReliableSync", `Subscribed to ${entityType} state`);
            resolve();
          }
        });
      })
    );

    subscribePromises.push(
      new Promise<void>((resolve, reject) => {
        client.subscribe(eventTopic, { qos: 1 }, (error) => {
          if (error) {
            logger.error("MqttReliableSync", `Failed to subscribe to ${entityType} events`, error);
            reject(error);
          } else {
            logger.debug("MqttReliableSync", `Subscribed to ${entityType} events`);
            resolve();
          }
        });
      })
    );

    if (enableCatchup) {
      const catchupTopic = `${baseTopic}/catchup`;
      subscribePromises.push(
        new Promise<void>((resolve, reject) => {
          client.subscribe(catchupTopic, { qos: 1 }, (catchupError) => {
            if (catchupError) {
              logger.error(
                "MqttReliableSync",
                "Failed to subscribe to catchup topic",
                catchupError
              );
              reject(catchupError);
            } else {
              logger.debug("MqttReliableSync", `Subscribed to ${entityType} catchup`);
              resolve();
            }
          });
        })
      );
    }

    await Promise.all(subscribePromises);
  } else {
    logger.debug(
      "MqttReliableSync",
      `Subscriptions tracked for ${entityType} state/events${enableCatchup ? "/catchup" : ""} (will subscribe when connected)`
    );
  }
}

/**
 * Unsubscribe from entity changes
 */
export async function unsubscribeFromEntity(
  client: mqtt.MqttClient | null,
  isConnected: boolean,
  subscriptions: Map<string, Set<(payload: any) => void>>,
  entityType: string,
  callback: (payload: any) => void
): Promise<void> {
  const baseTopic = getTopicForEntity(entityType);
  const stateTopic = `${baseTopic}/state`;
  const eventTopic = `${baseTopic}/events`;
  const catchupTopic = `${baseTopic}/catchup`;

  const unsubscribePromises: Promise<void>[] = [];

  for (const topic of [stateTopic, eventTopic, catchupTopic]) {
    if (subscriptions.has(topic)) {
      subscriptions.get(topic)!.delete(callback);

      if (subscriptions.get(topic)!.size === 0) {
        subscriptions.delete(topic);

        if (client && isConnected) {
          unsubscribePromises.push(
            new Promise<void>((resolve, reject) => {
              client.unsubscribe(topic, (error) => {
                if (error) {
                  logger.error("MqttReliableSync", `Failed to unsubscribe from ${topic}`, error);
                  reject(error);
                } else {
                  logger.debug("MqttReliableSync", `Unsubscribed from ${topic}`);
                  resolve();
                }
              });
            })
          );
        }
      }
    }
  }

  if (unsubscribePromises.length > 0) {
    await Promise.all(unsubscribePromises);
  }

  logger.debug("MqttReliableSync", `Removed callback for ${entityType}`);
}

/**
 * Resubscribe to all active subscriptions after reconnect
 */
export function resubscribeAll(
  client: mqtt.MqttClient | null,
  isConnected: boolean,
  subscriptions: Map<string, Set<(payload: any) => void>>
): void {
  if (!client || !isConnected) {
    return;
  }

  logger.debug("MqttReliableSync", `Resubscribing to ${subscriptions.size} topics`);

  subscriptions.forEach((_, topic) => {
    client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        logger.error("MqttReliableSync", `Failed to resubscribe to ${topic}`, error);
      }
    });
  });
}

/**
 * Check if a topic matches a subscription pattern
 */
export function topicMatches(pattern: string, topic: string): boolean {
  const patternParts = pattern.split("/");
  const topicParts = topic.split("/");

  if (patternParts.length > topicParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === "#") {
      return true;
    }
    if (patternParts[i] === "+") {
      continue;
    }
    if (patternParts[i] !== topicParts[i]) {
      return false;
    }
  }

  return patternParts.length === topicParts.length;
}
