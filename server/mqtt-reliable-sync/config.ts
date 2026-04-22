/**
 * MQTT Reliable Sync - Configuration
 *
 * Configuration defaults and topic definitions.
 */

import path from "node:path";
import type { ReliableSyncConfig } from "./types.js";

/**
 * Create default configuration
 */
export function createDefaultConfig(
  overrides: Partial<ReliableSyncConfig> = {}
): ReliableSyncConfig {
  const hostname = process.env.HOSTNAME || process.env.REPL_SLUG || "vessel_default";

  return {
    brokerUrl: overrides.brokerUrl || process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    clientIdPrefix: overrides.clientIdPrefix || "arus_sync",
    vesselId: overrides.vesselId || process.env.VESSEL_ID || hostname,
    reconnectPeriod: overrides.reconnectPeriod || 5000,
    qosLevel: overrides.qosLevel || 1, // Default to QoS 1 (at least once)
    maxQueueSize:
      overrides.maxQueueSize || Number.parseInt(process.env.MQTT_MAX_QUEUE_SIZE || "10000"),
    enableTls:
      overrides.enableTls ?? (process.env.MQTT_BROKER_URL?.startsWith("mqtts://") || false),
    queueDir: overrides.queueDir || path.join(process.cwd(), ".mqtt-queue"),
  };
}

/**
 * Topic definitions for dual-topic architecture
 */
export const topics = {
  // State topics (retained, current snapshot)
  state: {
    workOrders: "vessel/sync/work_orders/state",
    alerts: "vessel/sync/alerts/state",
    equipment: "vessel/sync/equipment/state",
    crew: "vessel/sync/crew/state",
    maintenance: "vessel/sync/maintenance/state",
  },

  // Event topics (not retained, sequenced deltas)
  events: {
    workOrders: "vessel/sync/work_orders/events",
    alerts: "vessel/sync/alerts/events",
    equipment: "vessel/sync/equipment/events",
    crew: "vessel/sync/crew/events",
    maintenance: "vessel/sync/maintenance/events",
  },

  // System events (QoS 1)
  system: "vessel/sync/system",
  conflicts: "vessel/sync/conflicts",

  // Catchup messages for reconnecting clients
  catchup: "vessel/sync/catchup/#",
};

/**
 * Get MQTT base topic for an entity type (without /state or /events suffix)
 */
export function getTopicForEntity(entityType: string): string {
  const topicMap: Record<string, string> = {
    work_orders: "vessel/sync/work_orders",
    alerts: "vessel/sync/alerts",
    equipment: "vessel/sync/equipment",
    crew: "vessel/sync/crew",
    maintenance_schedules: "vessel/sync/maintenance",
    maintenance: "vessel/sync/maintenance",
  };

  return topicMap[entityType] || `vessel/sync/${entityType}`;
}
