import { telemetryBufferDepth, telemetryBufferEvictions } from "./observability/telemetry-metrics";
import { batchWriterEvictedTotal } from "./telemetry-batch-writer-metrics";
import type {
  BatchWriterConfig,
  BatchWriterInternalStats,
  TelemetryBatchReading,
} from "./telemetry-batch-writer-types";
import { logger } from "./utils/logger";

type EmitFn = (eventName: string, payload: unknown) => void;

export class TelemetryBatchBufferStore {
  private vesselBuffers: Map<string, TelemetryBatchReading[]> = new Map();

  constructor(
    private readonly config: BatchWriterConfig,
    private readonly stats: BatchWriterInternalStats,
    private readonly emit: EmitFn
  ) {}

  getTotalSize(): number {
    let total = 0;
    for (const buffer of this.vesselBuffers.values()) {
      total += buffer.length;
    }
    return total;
  }

  getVesselCount(): number {
    return this.vesselBuffers.size;
  }

  getVesselBufferSizes(): Map<string, number> {
    const sizes = new Map<string, number>();
    for (const [vesselId, buffer] of this.vesselBuffers.entries()) {
      sizes.set(vesselId, buffer.length);
    }
    return sizes;
  }

  queue(reading: TelemetryBatchReading): void {
    const vesselId = this.getVesselId(reading.equipmentId);
    const buffer = this.getOrCreateBuffer(vesselId);
    buffer.push(reading);
    this.stats.totalQueued++;

    const perVesselMax = this.getPerVesselMax();
    if (buffer.length >= perVesselMax) {
      this.evictOldestFromVessel(vesselId);
    }

    if (this.stats.totalQueued % 1000 === 0) {
      const orgId = reading.orgId || "unknown";
      telemetryBufferDepth.set({ org_id: orgId, equipment_id: reading.equipmentId }, buffer.length);
    }
  }

  queueBatch(readings: TelemetryBatchReading[]): void {
    for (const reading of readings) {
      this.queue(reading);
    }
  }

  drainAll(): TelemetryBatchReading[] {
    const toFlush: TelemetryBatchReading[] = [];
    for (const [vesselId, buffer] of this.vesselBuffers.entries()) {
      toFlush.push(...buffer);
      this.vesselBuffers.set(vesselId, []);
    }
    return toFlush;
  }

  requeueForRetry(readings: TelemetryBatchReading[]): void {
    for (const reading of readings) {
      const vesselId = this.getVesselId(reading.equipmentId);
      this.getOrCreateBuffer(vesselId).unshift(reading);
    }

    for (const vesselId of this.vesselBuffers.keys()) {
      const buffer = this.vesselBuffers.get(vesselId)!;
      if (buffer.length > this.getPerVesselMax()) {
        this.evictOldestFromVessel(vesselId);
      }
    }
  }

  private getVesselId(equipmentId: string): string {
    const match = equipmentId.match(/^(vessel-\d+)/);
    return match?.[1] ?? "unknown";
  }

  private getOrCreateBuffer(vesselId: string): TelemetryBatchReading[] {
    let buffer = this.vesselBuffers.get(vesselId);
    if (!buffer) {
      buffer = [];
      this.vesselBuffers.set(vesselId, buffer);
    }
    return buffer;
  }

  private getPerVesselMax(): number {
    return Math.floor(this.config.maxBufferSize / Math.max(this.vesselBuffers.size, 1));
  }

  private evictOldestFromVessel(vesselId: string): void {
    const buffer = this.vesselBuffers.get(vesselId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const perVesselMax = this.getPerVesselMax();
    const evictCount = Math.floor(perVesselMax * this.config.evictionPercent);
    const evicted = buffer.splice(0, evictCount);

    this.stats.totalEvicted += evicted.length;
    batchWriterEvictedTotal.inc(evicted.length);

    if (evicted.length > 0 && evicted[0]) {
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
}
