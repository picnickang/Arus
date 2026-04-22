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
import { dbTelemetryStorage } from "./repositories";
import { telemetryBufferDepth, telemetryBufferEvictions } from "./observability/telemetry-metrics";
import client from "prom-client";
import { logger } from "./utils/logger";

export interface TelemetryReading {
  equipmentId: string;
  sensorType: string;
  value: number;
  timestamp: Date;
  deviceId?: string;
  orgId?: string;
  unit?: string;
  metadata?: Record<string, any>;
  _retryCount?: number; // Internal: tracks flush retry attempts
}

export interface BatchWriterStats {
  bufferSize: number;
  totalQueued: number;
  totalFlushed: number;
  totalEvicted: number;
  totalErrors: number;
  totalDropped: number; // Readings dropped after max retries
  lastFlushTime: Date | null;
  lastFlushDurationMs: number;
  lastFlushCount: number;
  avgFlushDurationMs: number;
  isRunning: boolean;
}

export interface BatchWriterConfig {
  batchIntervalMs: number;
  maxBufferSize: number;
  evictionPercent: number;
  flushOnShutdown: boolean;
  maxRetries: number; // Max flush retries before dropping readings (default 3)
}

const batchWriterFlushDuration = new client.Histogram({
  name: "arus_telemetry_batch_flush_duration_ms",
  help: "Telemetry batch flush duration in milliseconds",
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
  labelNames: ["status"],
});

const batchWriterFlushSize = new client.Histogram({
  name: "arus_telemetry_batch_flush_size",
  help: "Number of readings per batch flush",
  buckets: [1, 10, 50, 100, 250, 500, 1000, 2500, 5000],
});

const batchWriterEvictedTotal = new client.Counter({
  name: "arus_telemetry_batch_evicted_total",
  help: "Total telemetry readings evicted due to buffer overflow",
});

const batchWriterDroppedTotal = new client.Counter({
  name: "arus_telemetry_batch_dropped_total",
  help: "Total telemetry readings dropped after exceeding max retries",
});

const batchWriterRetriesTotal = new client.Counter({
  name: "arus_telemetry_batch_retries_total",
  help: "Total retry attempts for failed telemetry batch writes",
  labelNames: ["retry_attempt"],
});

const batchWriterRetryQueueSize = new client.Gauge({
  name: "arus_telemetry_batch_retry_queue_size",
  help: "Current number of readings queued for retry",
});

export class TelemetryBatchWriter extends EventEmitter {
  private vesselBuffers: Map<string, TelemetryReading[]> = new Map();
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

  private stats = {
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
      batchIntervalMs: Number.parseInt(process.env.TELEMETRY_BATCH_INTERVAL_MS || "500", 10),
      maxBufferSize: Number.parseInt(process.env.TELEMETRY_MAX_BUFFER_SIZE || "10000", 10),
      evictionPercent: Number.parseFloat(process.env.TELEMETRY_EVICTION_PERCENT || "0.1"),
      flushOnShutdown: true,
      maxRetries: Number.parseInt(process.env.TELEMETRY_MAX_RETRIES || "3", 10),
      ...config,
    };

    logger.info("TelemetryBatchWriter", "Initialized with config", {
      batchIntervalMs: this.config.batchIntervalMs,
      maxBufferSize: this.config.bufferSize,
      evictionPercent: this.config.evictionPercent,
      maxRetries: this.config.maxRetries,
    });
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

    const totalSize = this.getTotalBufferSize();
    if (this.config.flushOnShutdown && totalSize > 0) {
      logger.info(
        "TelemetryBatchWriter",
        `Final flush of ${totalSize} readings across ${this.vesselBuffers.size} vessels...`
      );
      await this.flush();
    }

    logger.info("TelemetryBatchWriter", "Stopped");
    this.emit("stopped");
  }

  /**
   * Extract vesselId from equipmentId (format: vessel-X-equipment-Y)
   * Falls back to "unknown" if pattern doesn't match
   */
  private getVesselId(equipmentId: string): string {
    const match = equipmentId.match(/^(vessel-\d+)/);
    return match ? match[1] : "unknown";
  }

  /**
   * Get total buffer size across all vessels
   */
  private getTotalBufferSize(): number {
    let total = 0;
    for (const buffer of this.vesselBuffers.values()) {
      total += buffer.length;
    }
    return total;
  }

  /**
   * Queue a telemetry reading for batched write
   * Non-blocking - returns immediately
   */
  queue(reading: TelemetryReading): void {
    const vesselId = this.getVesselId(reading.equipmentId);

    if (!this.vesselBuffers.has(vesselId)) {
      this.vesselBuffers.set(vesselId, []);
    }

    const buffer = this.vesselBuffers.get(vesselId)!;
    buffer.push(reading);
    this.stats.totalQueued++;

    const perVesselMax = Math.floor(this.config.bufferSize / Math.max(this.vesselBuffers.size, 1));
    if (buffer.length >= perVesselMax) {
      this.evictOldestFromVessel(vesselId);
    }

    if (this.stats.totalQueued % 1000 === 0) {
      const orgId = reading.orgId || "unknown";
      telemetryBufferDepth.set({ org_id: orgId, equipment_id: reading.equipmentId }, buffer.length);
    }
  }

  /**
   * Queue multiple telemetry readings at once
   */
  queueBatch(readings: TelemetryReading[]): void {
    for (const reading of readings) {
      this.queue(reading);
    }
  }

  /**
   * Evict oldest entries from a specific vessel buffer
   * Uses ring buffer semantics - removes oldest N%
   */
  private evictOldestFromVessel(vesselId: string): void {
    const buffer = this.vesselBuffers.get(vesselId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const perVesselMax = Math.floor(this.config.bufferSize / Math.max(this.vesselBuffers.size, 1));
    const evictCount = Math.floor(perVesselMax * this.config.evictionPercent);
    const evicted = buffer.splice(0, evictCount);

    this.stats.totalEvicted += evicted.length;
    batchWriterEvictedTotal.inc(evicted.length);

    if (evicted.length > 0) {
      const orgId = evicted[0].orgId || "unknown";
      const equipmentId = evicted[0].equipmentId;
      telemetryBufferEvictions.inc({ org_id: orgId, equipment_id: equipmentId }, evicted.length);

      logger.warn(
        "TelemetryBatchWriter",
        `Vessel ${vesselId} buffer overflow - evicted ${evicted.length} oldest readings`,
        {
          vesselId,
          bufferSize: buffer.length,
          perVesselMax,
          orgId,
          equipmentId,
        }
      );
    }

    this.emit("eviction", { vesselId, count: evicted.length, evicted });
  }

  /**
   * Flush buffered readings to database
   * Called automatically by timer, or manually for testing
   */
  async flush(): Promise<number> {
    const totalSize = this.getTotalBufferSize();
    if (this.isFlushing || totalSize === 0) {
      return 0;
    }

    this.isFlushing = true;
    const startTime = Date.now();

    const toFlush: TelemetryReading[] = [];
    for (const [vesselId, buffer] of this.vesselBuffers.entries()) {
      toFlush.push(...buffer);
      this.vesselBuffers.set(vesselId, []);
    }

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
        vesselCount: this.vesselBuffers.size,
      });

      return toFlush.length;
    } catch (flushError) {
      this.stats.totalErrors++;
      batchWriterFlushDuration.observe({ status: "error" }, Date.now() - startTime);

      const readingsToRetry: TelemetryReading[] = [];
      const readingsToDrop: TelemetryReading[] = [];

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
        const retryAttempt = readingsToRetry[0]._retryCount ?? 1;

        batchWriterRetriesTotal.inc(
          { retry_attempt: String(retryAttempt) },
          readingsToRetry.length
        );
        batchWriterRetryQueueSize.set(readingsToRetry.length);

        for (const reading of readingsToRetry) {
          const vesselId = this.getVesselId(reading.equipmentId);
          if (!this.vesselBuffers.has(vesselId)) {
            this.vesselBuffers.set(vesselId, []);
          }
          this.vesselBuffers.get(vesselId)!.unshift(reading);
        }

        for (const vesselId of this.vesselBuffers.keys()) {
          const perVesselMax = Math.floor(
            this.config.bufferSize / Math.max(this.vesselBuffers.size, 1)
          );
          const buffer = this.vesselBuffers.get(vesselId)!;
          if (buffer.length > perVesselMax) {
            this.evictOldestFromVessel(vesselId);
          }
        }

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
  private async writeToDatabase(readings: TelemetryReading[]): Promise<void> {
    if (readings.length === 0) {
      return;
    }

    const batchSize = 500;
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);

      const insertPromises = batch.map((reading) =>
        dbTelemetryStorage.createTelemetryReading({
          equipmentId: reading.equipmentId,
          sensorType: reading.sensorType,
          value: reading.value,
          timestamp: reading.timestamp,
          orgId: reading.orgId || "default-org-id",
          metadata: {
            ...reading.metadata,
            batchWriter: true,
            unit: reading.unit,
          },
        })
      );

      await Promise.all(insertPromises);
    }
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
  async writeBatch(readings: TelemetryReading[], options: { source: string }): Promise<void> {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && options.source !== "sqlite-bridge") {
      throw new Error(
        `Source guard violation: Only 'sqlite-bridge' source is allowed in production. Got: '${options.source}'`
      );
    }

    if (readings.length === 0) {
      return;
    }

    // Check for fault injection (testing only)
    if (TelemetryBatchWriter.faultInjectionEnabled) {
      this.stats.totalErrors++;
      throw TelemetryBatchWriter.faultInjectionError;
    }

    const startTime = Date.now();

    try {
      await this.writeToDatabase(readings);

      const duration = Date.now() - startTime;
      this.stats.totalFlushed += readings.length;
      this.stats.lastFlushTime = new Date();
      this.stats.lastFlushDurationMs = duration;
      this.stats.lastFlushCount = readings.length;

      this.stats.flushDurations.push(duration);
      if (this.stats.flushDurations.length > 100) {
        this.stats.flushDurations.shift();
      }

      batchWriterFlushDuration.observe({ status: "success" }, duration);
      batchWriterFlushSize.observe(readings.length);

      this.emit("batchWritten", {
        count: readings.length,
        durationMs: duration,
        source: options.source,
      });
    } catch (err) {
      this.stats.totalErrors++;
      batchWriterFlushDuration.observe({ status: "error" }, Date.now() - startTime);
      throw err;
    }
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
    return this.getTotalBufferSize();
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
      bufferSize: this.getTotalBufferSize(),
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
    return this.getTotalBufferSize();
  }

  /**
   * Get vessel count (for metrics)
   */
  getVesselCount(): number {
    return this.vesselBuffers.size;
  }

  /**
   * Get per-vessel buffer sizes (for detailed metrics)
   */
  getVesselBufferSizes(): Map<string, number> {
    const sizes = new Map<string, number>();
    for (const [vesselId, buffer] of this.vesselBuffers.entries()) {
      sizes.set(vesselId, buffer.length);
    }
    return sizes;
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
