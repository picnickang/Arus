import client from "prom-client";

export const batchWriterNaturalKeyConflicts = new client.Counter({
  name: "arus_telemetry_natural_key_conflicts_total",
  help:
    "Readings conflict-skipped by the (org_id, equipment_id, sensor_type, ts) " +
    "unique index during bulk insert — same-millisecond collisions collapse " +
    "to one stored row.",
});

export const batchWriterFlushDuration = new client.Histogram({
  name: "arus_telemetry_batch_flush_duration_ms",
  help: "Telemetry batch flush duration in milliseconds",
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
  labelNames: ["status"],
});

export const batchWriterFlushSize = new client.Histogram({
  name: "arus_telemetry_batch_flush_size",
  help: "Number of readings per batch flush",
  buckets: [1, 10, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const batchWriterEvictedTotal = new client.Counter({
  name: "arus_telemetry_batch_evicted_total",
  help: "Total telemetry readings evicted due to buffer overflow",
});

export const batchWriterDroppedTotal = new client.Counter({
  name: "arus_telemetry_batch_dropped_total",
  help: "Total telemetry readings dropped after exceeding max retries",
});

export const batchWriterRetriesTotal = new client.Counter({
  name: "arus_telemetry_batch_retries_total",
  help: "Total retry attempts for failed telemetry batch writes",
  labelNames: ["retry_attempt"],
});

export const batchWriterRetryQueueSize = new client.Gauge({
  name: "arus_telemetry_batch_retry_queue_size",
  help: "Current number of readings queued for retry",
});

export const batchWriterQuotaBlockedTotal = new client.Counter({
  name: "arus_telemetry_batch_quota_blocked_total",
  help: "Telemetry readings dropped at the bridge because the tenant is at or over `telemetry_rows_today`",
  labelNames: ["org_id"],
});

export const batchWriterQuotaIncrementFailedTotal = new client.Counter({
  name: "arus_telemetry_quota_increment_failed_total",
  help: "Per-org failures to record telemetry_rows_today usage after a successful batch write (timeout or quota service error). Ingest is not blocked; this counter signals undercounting.",
  labelNames: ["org_id", "reason"],
});
