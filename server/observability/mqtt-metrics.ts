import client from "prom-client";

// ===== MQTT RELIABLE SYNC METRICS =====
export const mqttMessagesPublishedTotal = new client.Counter({
  name: "arus_mqtt_messages_published_total",
  help: "Total MQTT messages successfully published",
  labelNames: ["entity_type", "operation", "qos"],
});

export const mqttMessagesQueuedTotal = new client.Counter({
  name: "arus_mqtt_messages_queued_total",
  help: "Total MQTT messages queued for later delivery",
});

export const mqttMessagesDroppedTotal = new client.Counter({
  name: "arus_mqtt_messages_dropped_total",
  help: "Total MQTT messages dropped due to queue overflow",
});

export const mqttPublishFailuresTotal = new client.Counter({
  name: "arus_mqtt_publish_failures_total",
  help: "Total MQTT publish failures",
});

export const mqttReconnectionAttemptsTotal = new client.Counter({
  name: "arus_mqtt_reconnection_attempts_total",
  help: "Total MQTT reconnection attempts",
});

export const mqttQueueFlushesTotal = new client.Counter({
  name: "arus_mqtt_queue_flushes_total",
  help: "Total MQTT queue flush operations",
});

export const mqttQueueDepthGauge = new client.Gauge({
  name: "arus_mqtt_queue_depth",
  help: "Current number of messages in MQTT queue",
});

export const mqttQueueUtilizationGauge = new client.Gauge({
  name: "arus_mqtt_queue_utilization_percent",
  help: "MQTT queue utilization percentage",
});

export const mqttConnectionStatusGauge = new client.Gauge({
  name: "arus_mqtt_connection_status",
  help: "MQTT connection status (1=connected, 0=disconnected)",
});

// Helper functions
export function recordMqttPublish(entityType: string, operation: string, qos: number) {
  mqttMessagesPublishedTotal.inc({ entity_type: entityType, operation, qos: qos.toString() });
}

export function recordMqttQueued() {
  mqttMessagesQueuedTotal.inc();
}

export function recordMqttDropped() {
  mqttMessagesDroppedTotal.inc();
}

export function recordMqttFailure() {
  mqttPublishFailuresTotal.inc();
}

export function recordMqttReconnection() {
  mqttReconnectionAttemptsTotal.inc();
}

export function recordMqttQueueFlush() {
  mqttQueueFlushesTotal.inc();
}

export function setMqttQueueDepth(depth: number) {
  mqttQueueDepthGauge.set(depth);
}

export function setMqttQueueUtilization(percent: number) {
  mqttQueueUtilizationGauge.set(percent);
}

export function setMqttConnectionStatus(connected: boolean) {
  mqttConnectionStatusGauge.set(connected ? 1 : 0);
}

// Update MQTT metrics batch function
export function updateMqttMetrics(metrics: {
  currentQueueSize?: number;
  queueUtilization?: number;
  isConnected?: boolean;
}) {
  if (metrics.currentQueueSize !== undefined) {
    mqttQueueDepthGauge.set(metrics.currentQueueSize);
  }

  if (metrics.queueUtilization !== undefined) {
    mqttQueueUtilizationGauge.set(metrics.queueUtilization);
  }

  if (metrics.isConnected !== undefined) {
    mqttConnectionStatusGauge.set(metrics.isConnected ? 1 : 0);
  }
}

// Backward-compatible aliases (original function names)
export const incrementMqttMessagesPublished = recordMqttPublish;
export const incrementMqttMessagesQueued = recordMqttQueued;
export const incrementMqttMessagesDropped = recordMqttDropped;
export const incrementMqttPublishFailures = recordMqttFailure;
export const incrementMqttReconnectionAttempts = recordMqttReconnection;
export const incrementMqttQueueFlushes = recordMqttQueueFlush;
