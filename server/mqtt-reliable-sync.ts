/**
 * MQTT Reliable Sync - Backward Compatibility Shim
 * 
 * DEPRECATED: This file re-exports from the modular mqtt-reliable-sync/ directory.
 * New code should import directly from './mqtt-reliable-sync/index.js'.
 * 
 * Original: 1,067 lines → Modularized into 9 files:
 * - mqtt-reliable-sync/types.ts (~60 lines): Core types and interfaces
 * - mqtt-reliable-sync/config.ts (~75 lines): Configuration and topic definitions
 * - mqtt-reliable-sync/queue-persistence.ts (~75 lines): JSONL file-based persistence
 * - mqtt-reliable-sync/message-queue.ts (~105 lines): In-memory queue management
 * - mqtt-reliable-sync/subscription.ts (~160 lines): Topic subscription handling
 * - mqtt-reliable-sync/publishing.ts (~160 lines): Dual-topic message publishing
 * - mqtt-reliable-sync/catchup.ts (~115 lines): Catchup message handling
 * - mqtt-reliable-sync/mqtt-reliable-sync.ts (~300 lines): Main service class
 * - mqtt-reliable-sync/index.ts (~35 lines): Module aggregator
 */

export { MqttReliableSyncService, mqttReliableSync } from "./mqtt-reliable-sync/index.js";
export type {
  MqttMessage,
  ReliableSyncConfig,
  MqttMetrics,
  ServiceMetrics,
  HealthStatus,
  PublishOptions,
  DataChangeOperation,
} from "./mqtt-reliable-sync/index.js";
