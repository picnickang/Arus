import type { RawFrame } from "../decode/types";
import type { TelemetryBatchReading } from "../../telemetry-batch-writer";
import type { ITelemetryPersistence, IDeadLetterQueue, IMetricsEmitter } from "../ports/outbound";
import type { IngestBatchResult, IBatchProcessor } from "../ports/inbound";
import { logger } from "../../utils/logger";
import type { RawTelemetryArchiveAdapter } from "../adapters/raw-archive";
import type { EquipmentHeartbeatAdapter, HeartbeatUpdate } from "../adapters/equipment-heartbeat";
import type { TelemetryBatchAckAdapter } from "../adapters/batch-ack";

export interface IngestTelemetryBatchConfig {
  persistence: ITelemetryPersistence;
  deadLetterQueue: IDeadLetterQueue<{ readings: TelemetryBatchReading[]; frameIds: number[] }>;
  metrics: IMetricsEmitter;
  processor: IBatchProcessor;
  circuitBreaker?: {
    isOpen: () => boolean;
    execute: <T>(fn: () => Promise<T>) => Promise<T>;
  };
  rawArchive?: RawTelemetryArchiveAdapter;
  heartbeat?: EquipmentHeartbeatAdapter;
  batchAck?: TelemetryBatchAckAdapter;
  orgId?: string;
}

export class IngestTelemetryBatch {
  private readonly config: IngestTelemetryBatchConfig;

  constructor(config: IngestTelemetryBatchConfig) {
    this.config = config;
  }

  async execute(frames: RawFrame[], batchId?: string): Promise<IngestBatchResult> {
    const startTime = Date.now();
    const result: IngestBatchResult = {
      framesProcessed: frames.length,
      readingsDecoded: 0,
      readingsPersisted: 0,
      duplicatesSkipped: 0,
      failedToDeadLetter: 0,
      archiveId: undefined,
      batchId,
    };

    if (frames.length === 0) {
      return result;
    }

    this.config.metrics.incFramesRead(frames.length);

    if (this.config.rawArchive && this.config.orgId) {
      try {
        const protocol = frames[0]?.protocol ?? "unknown";
        const source = frames[0]?.source ?? "unknown";
        const archiveResult = await this.config.rawArchive.archiveRawPayload({
          orgId: this.config.orgId,
          source,
          protocol,
          schemaVersion: frames[0]?.payloadFormatVersion ?? 1,
          frames: frames.map((f) => f.payload),
        });
        result.archiveId = archiveResult.archiveId;

        if (archiveResult.isDuplicate) {
          logger.debug("IngestTelemetryBatch", "Duplicate archive detected", {
            archiveId: archiveResult.archiveId,
          });
        }
      } catch (err) {
        logger.error("IngestTelemetryBatch", "Failed to archive raw payload", { error: err });
      }
    }

    const batchAck = this.config.batchAck;
    const orgId = this.config.orgId;
    const shouldTrackBatch =
      batchAck !== undefined && orgId !== undefined && batchId !== undefined && batchId.length > 0;
    if (shouldTrackBatch && batchAck && orgId) {
      try {
        const timestamps = frames
          .map((f) => new Date(f.ts))
          .sort((a, b) => a.getTime() - b.getTime());
        const firstFrame = frames[0];
        const firstTs = timestamps[0];
        const lastTs = timestamps[timestamps.length - 1];
        if (firstFrame && firstTs && lastTs) {
          await batchAck.receiveBatch({
            batchId,
            orgId,
            source: firstFrame.source ?? "unknown",
            frameCount: frames.length,
            firstFrameTs: firstTs,
            lastFrameTs: lastTs,
          });
        }
      } catch (err) {
        logger.error("IngestTelemetryBatch", "Failed to register batch", { error: err });
      }
    }

    const readings = this.config.processor.process(frames);
    result.readingsDecoded = readings.length;
    this.config.metrics.incReadingsDecoded(readings.length);

    if (readings.length === 0) {
      return result;
    }

    const frameIds = frames.map((f) => f.id);

    if (this.config.circuitBreaker?.isOpen()) {
      logger.warn("IngestTelemetryBatch", "Circuit breaker open, sending to DLQ", {
        readingsCount: readings.length,
      });
      this.config.deadLetterQueue.add(
        { readings, frameIds },
        "Circuit breaker open - persistence unavailable",
        "ingest-batch"
      );
      this.config.metrics.incDLQAdded("circuit-open");
      result.failedToDeadLetter = readings.length;
      return result;
    }

    const uniqueReadings: TelemetryBatchReading[] = [];
    for (const reading of readings) {
      const idempotencyKey = reading.metadata?.idempotencyKey as string | undefined;
      if (idempotencyKey) {
        const exists = await this.config.persistence.checkIdempotency(idempotencyKey);
        if (exists) {
          result.duplicatesSkipped++;
          continue;
        }
      }
      uniqueReadings.push(reading);
    }

    if (uniqueReadings.length === 0) {
      return result;
    }

    const commitStart = Date.now();

    try {
      if (this.config.circuitBreaker) {
        await this.config.circuitBreaker.execute(async () => {
          await this.config.persistence.writeBatch(uniqueReadings);
        });
      } else {
        await this.config.persistence.writeBatch(uniqueReadings);
      }

      const commitLatency = Date.now() - commitStart;
      this.config.metrics.observeCommitLatency(commitLatency);
      this.config.metrics.incBatchCommitted(uniqueReadings.length);

      for (const reading of uniqueReadings) {
        const key = reading.metadata?.idempotencyKey as string | undefined;
        if (key) {
          await this.config.persistence.markIdempotent(key).catch(() => {});
        }
      }

      result.readingsPersisted = uniqueReadings.length;
      logger.debug("IngestTelemetryBatch", "Batch persisted", {
        count: uniqueReadings.length,
        latencyMs: commitLatency,
      });

      if (this.config.heartbeat && this.config.orgId) {
        try {
          const heartbeatUpdates: HeartbeatUpdate[] = [];
          const seenEquipment = new Set<string>();

          for (const reading of uniqueReadings) {
            if (reading.equipmentId && !seenEquipment.has(reading.equipmentId)) {
              seenEquipment.add(reading.equipmentId);
              heartbeatUpdates.push({
                equipmentId: reading.equipmentId,
                orgId: this.config.orgId,
                signalType: reading.sensorType,
                value: reading.value,
                protocol: frames[0]?.protocol,
                source: frames[0]?.source,
              });
            }
          }

          if (heartbeatUpdates.length > 0) {
            await this.config.heartbeat.batchUpdateHeartbeats(heartbeatUpdates);
          }
        } catch (err) {
          logger.error("IngestTelemetryBatch", "Failed to update heartbeats", { error: err });
        }
      }

      if (shouldTrackBatch && batchAck && batchId) {
        try {
          const processingTimeMs = Date.now() - startTime;
          await batchAck.acknowledgeBatch({
            batchId,
            readingsDecoded: result.readingsDecoded,
            readingsPersisted: result.readingsPersisted,
            errorCount: 0,
            processingTimeMs,
          });
        } catch (err) {
          logger.error("IngestTelemetryBatch", "Failed to acknowledge batch", { error: err });
        }
      }

      if (this.config.rawArchive && result.archiveId) {
        try {
          await this.config.rawArchive.markDecoded(result.archiveId, uniqueReadings.length);
        } catch (err) {
          logger.error("IngestTelemetryBatch", "Failed to mark archive as decoded", { error: err });
        }
      }
    } catch (err) {
      logger.error("IngestTelemetryBatch", "Failed to persist batch", { error: err });

      this.config.deadLetterQueue.add(
        { readings: uniqueReadings, frameIds },
        err instanceof Error ? err.message : String(err),
        "ingest-batch"
      );
      this.config.metrics.incDLQAdded("persist-error");
      result.failedToDeadLetter = uniqueReadings.length;

      if (shouldTrackBatch && batchAck && batchId) {
        await batchAck
          .markFailed(batchId, err instanceof Error ? err.message : String(err))
          .catch(() => {});
      }

      if (this.config.rawArchive && result.archiveId) {
        await this.config.rawArchive
          .markDecoded(result.archiveId, 0, err instanceof Error ? err.message : String(err))
          .catch(() => {});
      }
    }

    return result;
  }
}

export function createIngestTelemetryBatch(
  config: IngestTelemetryBatchConfig
): IngestTelemetryBatch {
  return new IngestTelemetryBatch(config);
}
