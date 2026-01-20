/**
 * MQTT Reliable Sync - Queue Persistence
 * 
 * Handles JSONL file-based queue persistence for message durability.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { MqttMessage } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Initialize queue directory
 */
export async function initializeQueueDirectory(queueDir: string): Promise<void> {
  try {
    await fs.mkdir(queueDir, { recursive: true });
    logger.debug("MqttReliableSync", `Queue directory initialized: ${queueDir}`);
  } catch (error) {
    logger.error("MqttReliableSync", "Failed to create queue directory", error);
    throw error;
  }
}

/**
 * Load persisted queue from JSONL file
 */
export async function loadPersistedQueue(queueDir: string): Promise<MqttMessage[]> {
  const queueFile = path.join(queueDir, "pending.jsonl");
  const messages: MqttMessage[] = [];

  try {
    const fileContent = await fs.readFile(queueFile, "utf-8");
    const lines = fileContent
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        messages.push(message);
      } catch (parseError) {
        logger.error("MqttReliableSync", "Failed to parse queued message", parseError);
      }
    }

    logger.info("MqttReliableSync", `Loaded ${messages.length} messages from persistent queue`);

    // Clear the file after loading
    await fs.writeFile(queueFile, "");
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      logger.error("MqttReliableSync", "Error loading persistent queue", error);
    }
    // File doesn't exist - this is fine for first run
  }

  return messages;
}

/**
 * Persist current queue to JSONL file
 */
export async function persistQueue(queueDir: string, messages: MqttMessage[]): Promise<void> {
  if (messages.length === 0) {return;}

  const queueFile = path.join(queueDir, "pending.jsonl");

  try {
    const lines = `${messages.map((msg) => JSON.stringify(msg)).join("\n")  }\n`;
    await fs.writeFile(queueFile, lines);
    logger.debug("MqttReliableSync", `Persisted ${messages.length} messages to queue`);
  } catch (error) {
    logger.error("MqttReliableSync", "Failed to persist queue", error);
  }
}
