/**
 * Telemetry Batch Writer Service
 *
 * Provides centralized, high-performance batched writes for all telemetry ingestion sources.
 * Replaces per-packet DB writes with configurable batch intervals to prevent database
 * bottlenecks and improve throughput under high telemetry load.
 *
 * Features:
 * - Configurable batch interval (TELEMETRY_BATCH_INTERVAL_MS, default 500ms)
 * - Bounded buffer with ring buffer eviction (TELEMETRY_MAX_BUFFER_SIZE, default 10000)
 * - Per-stream isolation to prevent cross-equipment interference
 * - Prometheus metrics for buffer depth, evictions, flush latency
 * - Graceful shutdown with final flush
 *
 * Trade-offs:
 * - Batching introduces latency (up to BATCH_INTERVAL_MS) before data hits the DB
 * - Ring buffer eviction may drop oldest readings under extreme load
 * - Tune BATCH_INTERVAL_MS lower (100-250ms) for near-real-time needs
 * - Tune BATCH_INTERVAL_MS higher (1000-2000ms) for throughput over latency
 *
 * Usage:
 *   import { telemetryBatchWriter } from './telemetry-batch-writer';
 *
 *   // Queue a reading (non-blocking)
 *   telemetryBatchWriter.queue(reading);
 *
 *   // Get health stats
 *   const stats = telemetryBatchWriter.getStats();
 */

import { EventEmitter } from "node:events";
import { logger } from "./utils/logger";
import { TelemetryBatchBufferStore } from "./telemetry-batch-writer-buffer";
import {
  batchWriterDroppedTotal,
  batchWriterFlushDuration,
  batchWriterFlushSize,
  batchWriterRetriesTotal,
  batchWriterRetryQueueSize,
} from "./telemetry-batch-writer-metrics";
import { writeTelemetryBatchDirect } from "./telemetry-batch-writer-direct";
import { latestPerEquipmentSensor } from "./telemetry-batch-writer-latest";
import { insertTelemetryReadings } from "./telemetry-batch-writer-persistence";
import {
  applyIngestConfigs,
  broadcastFlushedReadings,
  evaluateAlertsForFlushedReadings,
} from "./telemetry-batch-writer-post-flush";
import type {
  BatchWriterConfig,
  BatchWriterInternalStats,
  BatchWriterStats,
  TelemetryBatchReading,
} from "./telemetry-batch-writer-types";

export { latestPerEquipmentSensor } from "./telemetry-batch-writer-latest";
export type {
  BatchWriterConfig,
  BatchWriterStats,
  TelemetryBatchReading,
} from "./telemetry-batch-writer-types";

export class TelemetryBatchWriter extends EventEmitter {
  private buffers: TelemetryBatchBufferStore;
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isFlushing = false;

  // Fault injection for testing - when enabled, writeBatch will throw
  private static faultInjectionEnabled = false;
  private static faultInjectionError = new Error(
    "Simulated PostgreSQL connection failure (fault injection)"
  );

  /** Enable fault injection to simulate PG failures during testing */
  static enableFaultInjection(enabled: boolean): void {
    TelemetryBatchWriter.faultInjectionEnabled = enabled;
  }

  /** Check if fault injection is currently enabled */
  static isFaultInjectionEnabled(): boolean {
    return TelemetryBatchWriter.faultInjectionEnabled;
  }

  private stats: BatchWriterInternalStats = {
    totalQueued: 0,
    totalFlushed: 0,
    totalEvicted: 0,
    totalErrors: 0,
    totalDropped: 0,
    lastFlushTime: null as Date | null,
    lastFlushDurationMs: 0,
    lastFlushCount: 0,
    flushDurations: [] as number[],
  };

  private config: BatchWriterConfig;

  constructor(config: Partial<BatchWriterConfig> = {}) {
    super();

    this.config = {
      batchIntervalMs: Number.parseInt(process.env["TELEMETRY_BATCH_INTERVAL_MS"] || "500", 10),
      maxBufferSize: Number.parseInt(process.env["TELEMETRY_MAX_BUFFER_SIZE"] || "10000", 10),
      evictionPercent: Number.parseFloat(process.env["TELEMETRY_EVICTION_PERCENT"] || "0.1"),
      flushOnShutdown: true,
      maxRetries: Number.parseInt(process.env["TELEMETRY_MAX_RETRIES"] || "3", 10),
      dbInsertChunkSize: Number.parseInt(
        process.env["TELEMETRY_DB_INSERT_CHUNK_SIZE"] || "500",
        10
      ),
      ...config,
    };

    // Guard the multi-row INSERT statement size: an invalid/non-positive
    // override falls back to 500, and we clamp to 1000 so a misconfiguration
    // can't blow past the Postgres bind-parameter limit (~65535 / cols-per-row).
    if (!Number.isFinite(this.config.dbInsertChunkSize) || this.config.dbInsertChunkSize <= 0) {
      this.config.dbInsertChunkSize = 500;
    }
    this.config.dbInsertChunkSize = Math.min(this.config.dbInsertChunkSize, 1000);

    logger.info("TelemetryBatchWriter", "Initialized with config", {
      batchIntervalMs: this.config.batchIntervalMs,
      maxBufferSize: this.config.maxBufferSize,
      evictionPercent: this.config.evictionPercent,
      maxRetries: this.config.maxRetries,
      dbInsertChunkSize: this.config.dbInsertChunkSize,
    });

    this.buffers = new TelemetryBatchBufferStore(this.config, this.stats, (eventName, payload) =>
      this.emit(eventName, payload)
    );
  }

  /**
   * Start the batch writer service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("TelemetryBatchWriter", "Already running");
      return;
    }

    this.isRunning = true;

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        logger.error("TelemetryBatchWriter", "Flush error", err);
        this.stats.totalErrors++;
      });
    }, this.config.batchIntervalMs);

    logger.info("TelemetryBatchWriter", `Started (flush every ${this.config.batchIntervalMs}ms)`);
    this.emit("started");
  }

  /**
   * Stop the batch writer service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    const totalSize = this.buffers.getTotalSize();
    if (this.config.flushOnShutdown && totalSize > 0) {
      logger.info(
        "TelemetryBatchWriter",
        `Final flush of ${totalSize} readings across ${this.buffers.getVesselCount()} vessels...`
      );
      await this.flush();
    }

    logger.info("TelemetryBatchWriter", "Stopped");
    this.emit("stopped");
  }

  /**
   * Queue a telemetry reading for batched write
   * Non-blocking - returns immediately
   */
  queue(reading: TelemetryBatchReading): void {
    this.buffers.queue(reading);
  }

  /**
   * Queue multiple telemetry readings at once
   */
  queueBatch(readings: TelemetryBatchReading[]): void {
    this.buffers.queueBatch(readings);
  }

  /**
   * Flush buffered readings to database
   * Called automatically by timer, or manually for testing
   */
  async flush(): Promise<number> {
    const totalSize = this.buffers.getTotalSize();
    if (this.isFlushing || totalSize === 0) {
      return 0;
    }

    this.isFlushing = true;
    const startTime = Date.now();

    const toFlush = this.buffers.drainAll();

    try {
      await this.writeToDatabase(toFlush);

      const duration = Date.now() - startTime;
      this.stats.lastFlushTime = new Date();
      this.stats.lastFlushDurationMs = duration;
      this.stats.lastFlushCount = toFlush.length;
      this.stats.totalFlushed += toFlush.length;

      this.stats.flushDurations.push(duration);
      if (this.stats.flushDurations.length > 100) {
        this.stats.flushDurations.shift();
      }

      batchWriterFlushDuration.observe({ status: "success" }, duration);
      batchWriterFlushSize.observe(toFlush.length);
      batchWriterRetryQueueSize.set(0);

      this.emit("flush", {
        count: toFlush.length,
        durationMs: duration,
        vesselCount: this.buffers.getVesselCount(),
      });

      return toFlush.length;
    } catch (flushError) {
      this.stats.totalErrors++;
      batchWriterFlushDuration.observe({ status: "error" }, Date.now() - startTime);

      const readingsToRetry: TelemetryBatchReading[] = [];
      const readingsToDrop: TelemetryBatchReading[] = [];

      for (const reading of toFlush) {
        const retryCount = (reading._retryCount ?? 0) + 1;
        if (retryCount >= this.config.maxRetries) {
          readingsToDrop.push(reading);
        } else {
          readingsToRetry.push({ ...reading, _retryCount: retryCount });
        }
      }

      if (readingsToDrop.length > 0) {
        this.stats.totalDropped += readingsToDrop.length;
        batchWriterDroppedTotal.inc(readingsToDrop.length);
        logger.warn(
          "TelemetryBatchWriter",
          `Dropped ${readingsToDrop.length} readings after ${this.config.maxRetries} retries`
        );
        this.emit("dropped", { count: readingsToDrop.length, readings: readingsToDrop });
      }

      if (readingsToRetry.length > 0) {
        const retryAttempt = readingsToRetry[0]?._retryCount ?? 1;

        batchWriterRetriesTotal.inc(
          { retry_attempt: String(retryAttempt) },
          readingsToRetry.length
        );
        batchWriterRetryQueueSize.set(readingsToRetry.length);

        this.buffers.requeueForRetry(readingsToRetry);

        logger.error(
          "TelemetryBatchWriter",
          `Flush failed, ${readingsToRetry.length} readings re-queued`,
          {
            retryAttempt,
            maxRetries: this.config.maxRetries,
            error: flushError instanceof Error ? flushError.message : String(flushError),
          }
        );
      } else {
        batchWriterRetryQueueSize.set(0);
      }

      this.emit("error", flushError);
      throw flushError;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Write readings to database in a single batch operation
   */
  private async writeToDatabase(readings: TelemetryBatchReading[]): Promise<void> {
    if (readings.length === 0) {
      return;
    }

    // Apply sensor configurations (gain/offset, disabled-drop, bounds
    // flags) before the insert. applySensorConfiguration defined these
    // semantics per-reading but nothing on the bulk path ever invoked it,
    // so configured gain/offset were silently ignored at ingest. Configs
    // are fetched once per org on a 30s TTL; readings without a config
    // pass through untouched.
    readings = await applyIngestConfigs(readings);
    if (readings.length === 0) {
      return;
    }

    // One multi-row INSERT per chunk (conflict-skip on the 0024 natural key)
    // instead of `batch.length` concurrent single-row inserts. Chunk size is
    // configurable because each row contributes several bind parameters and a
    // single statement must stay under the Postgres parameter limit.
    // Throws on failure so flush()'s retry/requeue/drop path still engages.
    // Skipped duplicates are not fatal and are excluded from the return value;
    // quota/stats counters intentionally stay on the attempted (accepted)
    // count in writeBatch, preserving their current accepted-vs-dropped meaning.
    await insertTelemetryReadings(readings, this.config.dbInsertChunkSize);

    // Post-commit enrichment on the deduped latest-per-(equipment, sensor)
    // set — bounded by sensor count, not message rate, so a 2,000 msg/s
    // flush still evaluates only a handful of readings:
    //  1. Live push: the WebSocket layer already had a 250ms-throttled
    //     telemetry channel (TelemetryThrottler → "telemetry_batch") with
    //     no producer — this is the producer.
    //  2. Alert thresholds: checkAndCreateAlerts existed but nothing on
    //     the ingest path ever invoked it, so threshold breaches in
    //     ingested telemetry never fired alerts.
    // Both are best-effort by design: they must never fail a flush.
    const latest = latestPerEquipmentSensor(readings);
    broadcastFlushedReadings(latest);
    void evaluateAlertsForFlushedReadings(latest);
  }

  /**
   * Write a batch of readings synchronously (for sqlite-bridge)
   *
   * Critical: This method enforces single-path ingestion - only 'sqlite-bridge' source is allowed
   * in production. This bypasses the queue and writes directly to the database, which is
   * necessary for cursor safety (cursor advances only after successful Postgres commit).
   *
   * @param readings - Array of telemetry readings to write
   * @param options.source - Must be 'sqlite-bridge' in production
   * @throws Error if source is not 'sqlite-bridge' in production
   */
  async writeBatch(readings: TelemetryBatchReading[], options: { source: string }): Promise<void> {
    await writeTelemetryBatchDirect(readings, options, {
      stats: this.stats,
      emit: (eventName, payload) => this.emit(eventName, payload),
      writeToDatabase: (allowedReadings) => this.writeToDatabase(allowedReadings),
      isFaultInjectionEnabled: () => TelemetryBatchWriter.faultInjectionEnabled,
      faultInjectionError: TelemetryBatchWriter.faultInjectionError,
    });
  }

  /**
   * Force an immediate flush of all buffered readings
   * Returns the number of readings flushed
   */
  async flushOnce(): Promise<number> {
    return this.flush();
  }

  /**
   * Get current queue depth across all vessels (for backpressure monitoring)
   */
  getQueueDepth(): number {
    return this.buffers.getTotalSize();
  }

  /**
   * Get current statistics
   */
  getStats(): BatchWriterStats {
    const avgDuration =
      this.stats.flushDurations.length > 0
        ? this.stats.flushDurations.reduce((a, b) => a + b, 0) / this.stats.flushDurations.length
        : 0;

    return {
      bufferSize: this.buffers.getTotalSize(),
      totalQueued: this.stats.totalQueued,
      totalFlushed: this.stats.totalFlushed,
      totalEvicted: this.stats.totalEvicted,
      totalErrors: this.stats.totalErrors,
      totalDropped: this.stats.totalDropped,
      lastFlushTime: this.stats.lastFlushTime,
      lastFlushDurationMs: this.stats.lastFlushDurationMs,
      lastFlushCount: this.stats.lastFlushCount,
      avgFlushDurationMs: Math.round(avgDuration),
      isRunning: this.isRunning,
    };
  }

  /**
   * Get buffer size (for health checks)
   */
  getBufferSize(): number {
    return this.buffers.getTotalSize();
  }

  /**
   * Get vessel count (for metrics)
   */
  getVesselCount(): number {
    return this.buffers.getVesselCount();
  }

  /**
   * Get per-vessel buffer sizes (for detailed metrics)
   */
  getVesselBufferSizes(): Map<string, number> {
    return this.buffers.getVesselBufferSizes();
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export const telemetryBatchWriter = new TelemetryBatchWriter();

import { batchWriterHealthCollector } from "./services/telemetry-health";
batchWriterHealthCollector.setMetricsProvider(telemetryBatchWriter);
