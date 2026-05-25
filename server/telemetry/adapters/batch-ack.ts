import { randomUUID } from "node:crypto";
import { eq, sql, and, desc, lt } from "drizzle-orm";
import { db } from "../../db-config";
import { telemetryBatchAck, type TelemetryBatchAck } from "@shared/schema/telemetry";
import { logger } from "../../utils/logger";
import client from "prom-client";

const batchReceivedTotal = new client.Counter({
  name: "arus_telemetry_batch_received_total",
  help: "Total telemetry batches received",
  labelNames: ["source"],
});

const batchAcknowledgedTotal = new client.Counter({
  name: "arus_telemetry_batch_acknowledged_total",
  help: "Total telemetry batches acknowledged",
  labelNames: ["source", "status"],
});

const batchProcessingHistogram = new client.Histogram({
  name: "arus_telemetry_batch_processing_ms",
  help: "Batch processing time in milliseconds",
  labelNames: ["source"],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
});

export interface BatchReceiveInput {
  batchId?: string;
  orgId: string;
  deviceId?: string;
  source: string;
  frameCount: number;
  firstFrameTs: Date;
  lastFrameTs: Date;
  metadata?: Record<string, unknown>;
}

export interface BatchAckResult {
  batchId: string;
  status: "received" | "duplicate";
  receivedAt: Date;
}

export interface BatchProcessResult {
  batchId: string;
  readingsDecoded: number;
  readingsPersisted: number;
  errorCount: number;
  processingTimeMs: number;
}

export class TelemetryBatchAckAdapter {
  async receiveBatch(input: BatchReceiveInput): Promise<BatchAckResult> {
    const batchId = input.batchId ?? randomUUID();
    const now = new Date();

    const existing = await db
      .select({ batchId: telemetryBatchAck.batchId, receivedAt: telemetryBatchAck.receivedAt })
      .from(telemetryBatchAck)
      .where(eq(telemetryBatchAck.batchId, batchId))
      .limit(1);

    if (existing.length > 0) {
      logger.debug("BatchAck", "Duplicate batch received", { batchId });
      return {
        batchId,
        status: "duplicate",
        receivedAt: existing[0]!.receivedAt,
      };
    }

    await db.insert(telemetryBatchAck).values({
      batchId,
      orgId: input.orgId,
      deviceId: input.deviceId,
      source: input.source,
      frameCount: input.frameCount,
      firstFrameTs: input.firstFrameTs,
      lastFrameTs: input.lastFrameTs,
      status: "received",
      metadata: input.metadata,
    });

    batchReceivedTotal.inc({ source: input.source });
    logger.info("BatchAck", "Batch received", {
      batchId,
      frameCount: input.frameCount,
      source: input.source,
    });

    return {
      batchId,
      status: "received",
      receivedAt: now,
    };
  }

  async acknowledgeBatch(result: BatchProcessResult): Promise<void> {
    const now = new Date();
    const status = result.errorCount > 0 ? "partial" : "acknowledged";

    await db
      .update(telemetryBatchAck)
      .set({
        acknowledgedAt: now,
        status,
        readingsDecoded: result.readingsDecoded,
        readingsPersisted: result.readingsPersisted,
        errorCount: result.errorCount,
        processingTimeMs: result.processingTimeMs,
      })
      .where(eq(telemetryBatchAck.batchId, result.batchId));

    const batch = await this.getBatch(result.batchId);
    const source = batch?.source ?? "unknown";

    batchAcknowledgedTotal.inc({ source, status });
    batchProcessingHistogram.observe({ source }, result.processingTimeMs);

    logger.info("BatchAck", "Batch acknowledged", {
      batchId: result.batchId,
      status,
      readingsPersisted: result.readingsPersisted,
      processingTimeMs: result.processingTimeMs,
    });
  }

  async markFailed(batchId: string, error: string): Promise<void> {
    await db
      .update(telemetryBatchAck)
      .set({
        status: "failed",
        errorCount: sql`COALESCE(${telemetryBatchAck.errorCount}, 0) + 1`,
        metadata: sql`jsonb_set(COALESCE(${telemetryBatchAck.metadata}, '{}'), '{lastError}', ${JSON.stringify(error)}::jsonb)`,
      })
      .where(eq(telemetryBatchAck.batchId, batchId));

    logger.warn("BatchAck", "Batch marked as failed", { batchId, error });
  }

  async getBatch(batchId: string): Promise<TelemetryBatchAck | undefined> {
    const [row] = await db
      .select()
      .from(telemetryBatchAck)
      .where(eq(telemetryBatchAck.batchId, batchId));
    return row;
  }

  async getUnacknowledgedBatches(orgId: string, limit: number = 100): Promise<TelemetryBatchAck[]> {
    return db
      .select()
      .from(telemetryBatchAck)
      .where(and(eq(telemetryBatchAck.orgId, orgId), eq(telemetryBatchAck.status, "received")))
      .orderBy(telemetryBatchAck.receivedAt)
      .limit(limit);
  }

  async getFailedBatches(orgId: string, limit: number = 100): Promise<TelemetryBatchAck[]> {
    return db
      .select()
      .from(telemetryBatchAck)
      .where(and(eq(telemetryBatchAck.orgId, orgId), eq(telemetryBatchAck.status, "failed")))
      .orderBy(desc(telemetryBatchAck.receivedAt))
      .limit(limit);
  }

  async retryBatch(batchId: string): Promise<void> {
    await db
      .update(telemetryBatchAck)
      .set({
        status: "received",
        acknowledgedAt: null,
      })
      .where(eq(telemetryBatchAck.batchId, batchId));

    logger.info("BatchAck", "Batch marked for retry", { batchId });
  }

  async getRecentBatches(
    orgId: string,
    options: { limit?: number; deviceId?: string; source?: string } = {}
  ): Promise<TelemetryBatchAck[]> {
    const conditions = [eq(telemetryBatchAck.orgId, orgId)];

    if (options.deviceId) {
      conditions.push(eq(telemetryBatchAck.deviceId, options.deviceId));
    }
    if (options.source) {
      conditions.push(eq(telemetryBatchAck.source, options.source));
    }

    return db
      .select()
      .from(telemetryBatchAck)
      .where(and(...conditions))
      .orderBy(desc(telemetryBatchAck.receivedAt))
      .limit(options.limit ?? 100);
  }

  async pruneOldBatches(retentionDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(telemetryBatchAck)
      .where(
        and(eq(telemetryBatchAck.status, "acknowledged"), lt(telemetryBatchAck.receivedAt, cutoff))
      );

    await db
      .delete(telemetryBatchAck)
      .where(
        and(eq(telemetryBatchAck.status, "acknowledged"), lt(telemetryBatchAck.receivedAt, cutoff))
      );

    const removed = Number(countResult[0]?.count ?? 0);
    logger.info("BatchAck", "Pruned old batches", { removed, retentionDays });
    return removed;
  }

  async getMetrics(orgId: string): Promise<{
    totalReceived: number;
    totalAcknowledged: number;
    totalFailed: number;
    avgProcessingTimeMs: number | null;
    pendingCount: number;
  }> {
    const statusCounts = await db
      .select({
        status: telemetryBatchAck.status,
        count: sql<number>`count(*)`,
        avgProcessingTime: sql<number>`avg(${telemetryBatchAck.processingTimeMs})`,
      })
      .from(telemetryBatchAck)
      .where(eq(telemetryBatchAck.orgId, orgId))
      .groupBy(telemetryBatchAck.status);

    const counts: Record<string, number> = {};
    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const row of statusCounts) {
      counts[row.status] = Number(row.count);
      if (row.avgProcessingTime && row.status === "acknowledged") {
        totalProcessingTime += row.avgProcessingTime * Number(row.count);
        processedCount += Number(row.count);
      }
    }

    return {
      totalReceived: Object.values(counts).reduce((a, b) => a + b, 0),
      totalAcknowledged: counts["acknowledged"] ?? 0,
      totalFailed: counts["failed"] ?? 0,
      avgProcessingTimeMs: processedCount > 0 ? totalProcessingTime / processedCount : null,
      pendingCount: counts["received"] ?? 0,
    };
  }
}

export const telemetryBatchAckAdapter = new TelemetryBatchAckAdapter();
