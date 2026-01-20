import client from "prom-client";

/**
 * Telemetry Ingestion Prometheus Metrics
 *
 * Provides observability for MQTT and HTTP telemetry ingestion pipeline:
 * - Message throughput and processing rates
 * - Queue depth and buffer utilization
 * - Validation failures and data quality
 * - Processing latency and backpressure
 */

// Telemetry messages processed counter
export const telemetryMessagesProcessed = new client.Counter({
  name: "arus_telemetry_messages_processed_total",
  help: "Total telemetry messages successfully processed",
  labelNames: ["org_id", "equipment_type", "sensor_type", "source"],
});

// Telemetry validation errors
export const telemetryValidationErrors = new client.Counter({
  name: "arus_telemetry_validation_errors_total",
  help: "Total telemetry messages rejected due to validation errors",
  labelNames: ["org_id", "error_type", "source"],
});

// Telemetry processing duration
export const telemetryProcessingDuration = new client.Histogram({
  name: "arus_telemetry_processing_duration_ms",
  help: "Telemetry message processing duration in milliseconds",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  labelNames: ["org_id", "source"],
});

// Telemetry buffer depth gauge
export const telemetryBufferDepth = new client.Gauge({
  name: "arus_telemetry_buffer_depth",
  help: "Current number of telemetry messages in processing buffer",
  labelNames: ["org_id", "equipment_id"],
});

// Telemetry buffer evictions (when buffer is full)
export const telemetryBufferEvictions = new client.Counter({
  name: "arus_telemetry_buffer_evictions_total",
  help: "Total number of telemetry messages evicted due to full buffer",
  labelNames: ["org_id", "equipment_id"],
});

// Data quality score histogram
export const telemetryDataQuality = new client.Histogram({
  name: "arus_telemetry_data_quality_score",
  help: "Data quality scores (0-1) for ingested telemetry",
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  labelNames: ["org_id", "equipment_type", "quality_dimension"],
});

// Telemetry throughput gauge (messages/sec)
export const telemetryThroughput = new client.Gauge({
  name: "arus_telemetry_throughput_msgs_per_sec",
  help: "Current telemetry ingestion throughput in messages per second",
  labelNames: ["org_id", "source"],
});

// MQTT message retries
export const mqttMessageRetries = new client.Counter({
  name: "arus_mqtt_message_retries_total",
  help: "Total MQTT message processing retries",
  labelNames: ["org_id", "client_id", "reason"],
});

// Stream aggregation latency
export const streamAggregationDuration = new client.Histogram({
  name: "arus_stream_aggregation_duration_ms",
  help: "Stream aggregation window processing duration in milliseconds",
  buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
  labelNames: ["org_id", "window_size"],
});

// Aggregates created counter
export const streamAggregatesCreated = new client.Counter({
  name: "arus_stream_aggregates_created_total",
  help: "Total number of stream aggregates created",
  labelNames: ["org_id", "window_size", "aggregation_function"],
});

// Dead letter queue messages
export const telemetryDeadLetterMessages = new client.Counter({
  name: "arus_telemetry_dead_letter_messages_total",
  help: "Total telemetry messages sent to dead letter queue",
  labelNames: ["org_id", "reason"],
});

// Kalman sensor fusion applications
export const kalmanFusionApplications = new client.Counter({
  name: "arus_kalman_fusion_applications_total",
  help: "Total applications of Kalman sensor fusion",
  labelNames: ["org_id", "sensor_type"],
});

// Security: Organization validation failures
export const telemetryOrgValidationFailures = new client.Counter({
  name: "arus_telemetry_org_validation_failures_total",
  help: "Total organization validation failures (security)",
  labelNames: ["org_id", "validation_type"],
});

/**
 * Helper: Record successful telemetry message processing
 */
export function recordTelemetryProcessed(params: {
  orgId: string;
  equipmentType: string;
  sensorType: string;
  source: "mqtt" | "http" | "csv";
  durationMs: number;
  dataQuality?: number;
}): void {
  telemetryMessagesProcessed.inc({
    org_id: params.orgId,
    equipment_type: params.equipmentType,
    sensor_type: params.sensorType,
    source: params.source,
  });

  telemetryProcessingDuration.observe(
    { org_id: params.orgId, source: params.source },
    params.durationMs
  );

  if (params.dataQuality !== undefined) {
    telemetryDataQuality.observe(
      { org_id: params.orgId, equipment_type: params.equipmentType, quality_dimension: "overall" },
      params.dataQuality
    );
  }
}

/**
 * Helper: Record telemetry validation error
 */
export function recordTelemetryValidationError(params: {
  orgId: string;
  errorType: string;
  source: "mqtt" | "http" | "csv";
}): void {
  telemetryValidationErrors.inc({
    org_id: params.orgId,
    error_type: params.errorType,
    source: params.source,
  });
}

/**
 * Helper: Update buffer depth
 */
export function updateBufferDepth(orgId: string, equipmentId: string, depth: number): void {
  telemetryBufferDepth.set({ org_id: orgId, equipment_id: equipmentId }, depth);
}

/**
 * Helper: Record buffer eviction
 */
export function recordBufferEviction(orgId: string, equipmentId: string): void {
  telemetryBufferEvictions.inc({ org_id: orgId, equipment_id: equipmentId });
}

/**
 * Helper: Update MQTT connection status
 * Note: Uses global metric from server/observability.ts to avoid duplicate registration
 */
export function updateMqttConnectionStatus(
  orgId: string,
  clientId: string,
  connected: boolean
): void {
  // Import and use the existing metric from observability.ts
  const { setMqttConnectionStatus } = require("../observability");
  setMqttConnectionStatus(clientId, connected ? 1 : 0);
}

/**
 * Helper: Record stream aggregate creation
 */
export function recordStreamAggregate(params: {
  orgId: string;
  windowSize: string;
  aggregationFunction: string;
  durationMs: number;
}): void {
  streamAggregatesCreated.inc({
    org_id: params.orgId,
    window_size: params.windowSize,
    aggregation_function: params.aggregationFunction,
  });

  streamAggregationDuration.observe(
    { org_id: params.orgId, window_size: params.windowSize },
    params.durationMs
  );
}

/**
 * Helper: Record data quality dimensions
 */
export function recordDataQualityDimensions(params: {
  orgId: string;
  equipmentType: string;
  completeness: number;
  consistency: number;
  timeliness: number;
  accuracy: number;
}): void {
  const dimensions: Record<string, number> = {
    completeness: params.completeness,
    consistency: params.consistency,
    timeliness: params.timeliness,
    accuracy: params.accuracy,
  };

  Object.entries(dimensions).forEach(([dimension, score]) => {
    telemetryDataQuality.observe(
      { org_id: params.orgId, equipment_type: params.equipmentType, quality_dimension: dimension },
      score
    );
  });
}
