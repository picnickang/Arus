import client from "prom-client";

// ===== TELEMETRY PROCESSING METRICS =====
export const telemetryProcessedTotal = new client.Counter({
  name: "arus_telemetry_processed_total",
  help: "Total telemetry readings processed",
  labelNames: ["equipment_id", "sensor_type", "vessel_id"],
});

export const telemetryErrorsTotal = new client.Counter({
  name: "arus_telemetry_errors_total",
  help: "Total telemetry processing errors",
  labelNames: ["error_type", "equipment_id"],
});

// ===== TELEMETRY INGESTION PIPELINE METRICS =====
export const telemetryBatchSize = new client.Histogram({
  name: "arus_telemetry_batch_size",
  help: "Size of telemetry batches being processed",
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
});

export const telemetryIngestionLatency = new client.Histogram({
  name: "arus_telemetry_ingestion_latency_ms",
  help: "End-to-end telemetry ingestion latency in milliseconds",
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const telemetryBufferUtilization = new client.Gauge({
  name: "arus_telemetry_buffer_utilization",
  help: "Telemetry buffer utilization percentage",
});

export const telemetryDroppedTotal = new client.Counter({
  name: "arus_telemetry_dropped_total",
  help: "Total telemetry points dropped due to buffer overflow or validation",
  labelNames: ["reason"],
});

// Helper functions
export function recordTelemetryProcessed(equipmentId: string, sensorType: string, vesselId: string, count: number = 1) {
  telemetryProcessedTotal.inc({ equipment_id: equipmentId, sensor_type: sensorType, vessel_id: vesselId }, count);
}

export function recordTelemetryError(errorType: string, equipmentId: string) {
  telemetryErrorsTotal.inc({ error_type: errorType, equipment_id: equipmentId });
}

export function recordTelemetryBatch(size: number) {
  telemetryBatchSize.observe(size);
}

export function recordTelemetryIngestionLatency(latencyMs: number) {
  telemetryIngestionLatency.observe(latencyMs);
}

export function setTelemetryBufferUtilization(percent: number) {
  telemetryBufferUtilization.set(percent);
}

export function recordTelemetryDropped(reason: "buffer_overflow" | "validation_failed" | "rate_limited") {
  telemetryDroppedTotal.inc({ reason });
}

// Backward-compatible aliases
export const incrementTelemetryProcessed = recordTelemetryProcessed;

export function incrementTelemetryError(errorType: string, equipmentId: string) {
  telemetryErrorsTotal.inc({ error_type: errorType, equipment_id: equipmentId });
}
