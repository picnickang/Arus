import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { eq, sql, and, desc, lt } from "drizzle-orm";
import { db } from "../../db-config";
import { rawTelemetryArchive, type RawTelemetryArchive } from "@shared/schema/telemetry";
import { logger } from "../../utils/logger";
import client from "prom-client";

const archiveWritesTotal = new client.Counter({
  name: "arus_telemetry_archive_writes_total",
  help: "Total raw telemetry archives written",
  labelNames: ["protocol", "status"],
});

const archiveDecodedTotal = new client.Counter({
  name: "arus_telemetry_archive_decoded_total",
  help: "Total raw telemetry archives decoded",
  labelNames: ["protocol", "status"],
});

const archivePendingGauge = new client.Gauge({
  name: "arus_telemetry_archive_pending",
  help: "Number of pending archives awaiting decode",
});

export interface RawArchivePayload {
  orgId: string;
  deviceId?: string;
  equipmentId?: string;
  source: string;
  protocol: string;
  schemaVersion: number;
  frames: Buffer[];
  metadata?: Record<string, unknown>;
}

export interface RawArchiveResult {
  archiveId: string;
  payloadHash: string;
  frameCount: number;
  isDuplicate: boolean;
}

export class RawTelemetryArchiveAdapter {
  async archiveRawPayload(payload: RawArchivePayload): Promise<RawArchiveResult> {
    const rawPayloadBase64 = payload.frames.map((f) => f.toString("base64")).join("|");
    const payloadHash = createHash("sha256")
      .update(`${payload.orgId}:${payload.source}:${payload.protocol}:${rawPayloadBase64}`)
      .digest("hex")
      .substring(0, 64);

    const existingDuplicate = await db
      .select({ id: rawTelemetryArchive.id })
      .from(rawTelemetryArchive)
      .where(
        and(
          eq(rawTelemetryArchive.payloadHash, payloadHash),
          eq(rawTelemetryArchive.decodeStatus, "pending")
        )
      )
      .limit(1);

    if (existingDuplicate.length > 0) {
      logger.debug("RawArchive", "Duplicate payload detected", {
        payloadHash,
        existingId: existingDuplicate[0]!.id,
      });
      return {
        archiveId: existingDuplicate[0]!.id,
        payloadHash,
        frameCount: payload.frames.length,
        isDuplicate: true,
      };
    }

    const archiveId = randomUUID();

    await db.insert(rawTelemetryArchive).values({
      orgId: payload.orgId,
      deviceId: payload.deviceId,
      equipmentId: payload.equipmentId,
      source: payload.source,
      protocol: payload.protocol,
      schemaVersion: payload.schemaVersion,
      rawPayload: rawPayloadBase64,
      payloadHash,
      frameCount: payload.frames.length,
      decodeStatus: "pending",
      metadata: payload.metadata,
    });

    archiveWritesTotal.inc({ protocol: payload.protocol, status: "success" });
    logger.info("RawArchive", "Archived raw payload", {
      archiveId,
      payloadHash,
      frameCount: payload.frames.length,
      protocol: payload.protocol,
    });

    return {
      archiveId,
      payloadHash,
      frameCount: payload.frames.length,
      isDuplicate: false,
    };
  }

  async markDecoded(archiveId: string, readingsGenerated: number, error?: string): Promise<void> {
    const status = error ? "failed" : "decoded";

    await db
      .update(rawTelemetryArchive)
      .set({
        decodedAt: new Date(),
        decodeStatus: status,
        decodeError: error,
        readingsGenerated,
      })
      .where(eq(rawTelemetryArchive.id, archiveId));

    const archive = await this.getById(archiveId);
    archiveDecodedTotal.inc({ protocol: archive?.protocol ?? "unknown", status });

    logger.info("RawArchive", `Archive marked as ${status}`, {
      archiveId,
      readingsGenerated,
      error,
    });
  }

  async getById(id: string): Promise<RawTelemetryArchive | undefined> {
    const [row] = await db.select().from(rawTelemetryArchive).where(eq(rawTelemetryArchive.id, id));
    return row;
  }

  async getPendingArchives(limit: number = 100): Promise<RawTelemetryArchive[]> {
    return db
      .select()
      .from(rawTelemetryArchive)
      .where(eq(rawTelemetryArchive.decodeStatus, "pending"))
      .orderBy(rawTelemetryArchive.receivedAt)
      .limit(limit);
  }

  async getFailedArchives(limit: number = 100): Promise<RawTelemetryArchive[]> {
    return db
      .select()
      .from(rawTelemetryArchive)
      .where(eq(rawTelemetryArchive.decodeStatus, "failed"))
      .orderBy(desc(rawTelemetryArchive.receivedAt))
      .limit(limit);
  }

  async retryFailed(archiveId: string): Promise<void> {
    await db
      .update(rawTelemetryArchive)
      .set({
        decodeStatus: "pending",
        decodeError: null,
        decodedAt: null,
      })
      .where(eq(rawTelemetryArchive.id, archiveId));

    logger.info("RawArchive", "Archive marked for retry", { archiveId });
  }

  async pruneOldArchives(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(rawTelemetryArchive)
      .where(
        and(
          eq(rawTelemetryArchive.decodeStatus, "decoded"),
          lt(rawTelemetryArchive.receivedAt, cutoff)
        )
      );

    await db
      .delete(rawTelemetryArchive)
      .where(
        and(
          eq(rawTelemetryArchive.decodeStatus, "decoded"),
          lt(rawTelemetryArchive.receivedAt, cutoff)
        )
      );

    const removed = Number(countResult[0]?.count ?? 0);
    logger.info("RawArchive", "Pruned old archives", { removed, retentionDays });
    return removed;
  }

  async getMetrics(): Promise<{
    totalPending: number;
    totalDecoded: number;
    totalFailed: number;
    oldestPendingAge: number | null;
  }> {
    const counts = await db
      .select({
        status: rawTelemetryArchive.decodeStatus,
        count: sql<number>`count(*)`,
      })
      .from(rawTelemetryArchive)
      .groupBy(rawTelemetryArchive.decodeStatus);

    const statusMap: Record<string, number> = {};
    for (const row of counts) {
      statusMap[row.status] = Number(row.count);
    }

    const oldestPending = await db
      .select({ receivedAt: rawTelemetryArchive.receivedAt })
      .from(rawTelemetryArchive)
      .where(eq(rawTelemetryArchive.decodeStatus, "pending"))
      .orderBy(rawTelemetryArchive.receivedAt)
      .limit(1);

    const pending = statusMap["pending"] ?? 0;
    archivePendingGauge.set(pending);

    return {
      totalPending: pending,
      totalDecoded: statusMap["decoded"] ?? 0,
      totalFailed: statusMap["failed"] ?? 0,
      oldestPendingAge: oldestPending[0]?.receivedAt
        ? Date.now() - oldestPending[0].receivedAt.getTime()
        : null,
    };
  }

  parseRawPayload(rawPayload: string): Buffer[] {
    return rawPayload.split("|").map((b64) => Buffer.from(b64, "base64"));
  }
}

export const rawTelemetryArchiveAdapter = new RawTelemetryArchiveAdapter();
