/**
 * MQTT Reliable Sync - Module Aggregator
 * 
 * Re-exports all MQTT reliable sync modules for convenient imports.
 * 
 * Module structure (1,067 lines → 9 modules):
 * - types.ts (~60 lines): Core types and interfaces
 * - config.ts (~75 lines): Configuration and topic definitions
 * - queue-persistence.ts (~75 lines): JSONL file-based persistence
 * - message-queue.ts (~105 lines): In-memory queue management
 * - subscription.ts (~160 lines): Topic subscription handling
 * - publishing.ts (~160 lines): Dual-topic message publishing
 * - catchup.ts (~115 lines): Catchup message handling
 * - mqtt-reliable-sync.ts (~300 lines): Main service class
 * - index.ts (~35 lines): This aggregator
 */

export * from "./types.js";
export { createDefaultConfig, topics, getTopicForEntity } from "./config.js";
export { initializeQueueDirectory, loadPersistedQueue, persistQueue } from "./queue-persistence.js";
export { enqueueMessage, flushMessageQueue } from "./message-queue.js";
export { subscribeToEntity, unsubscribeFromEntity, resubscribeAll, topicMatches } from "./subscription.js";
export { publishDataChange } from "./publishing.js";
export { publishCatchupMessages } from "./catchup.js";
export { MqttReliableSyncService, mqttReliableSync } from "./mqtt-reliable-sync.js";
