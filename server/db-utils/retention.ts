/**
 * Database Utils - Retention Management
 * Telemetry retention policy management
 *
 * `applyTelemetryRetention` is invoked by the daily pg-boss job
 * (server/job-processors/telemetry-retention-processor.ts) and by ad-hoc
 * admin tooling. Deletion strategy, in order:
 *
 *   1. Partition fast path — when equipment_telemetry is natively
 *      partitioned (migrations/0038), whole months older than the cutoff
 *      are DETACH+DROPped. DDL, instant, not subject to RLS.
 *   2. Batched row deletes — remaining expired rows (the boundary month,
 *      the DEFAULT partition, or the whole table when unpartitioned) are
 *      deleted in bounded batches per org under withTenantContext.
 *      equipment_telemetry has FORCE ROW LEVEL SECURITY: an unpinned
 *      DELETE silently matches zero rows for every other tenant in
 *      production, so the per-org fan-out is required for correctness,
 *      not just hygiene.
 *
 * Batches are keyed by the PK tuple (org_id, ts, id) — NOT ctid, which
 * is only unique within one physical relation and is unsafe through a
 * partitioned parent. Batch size and the per-run batch cap keep locks
 * and WAL bounded; a capped run reports `exhausted: true` and the next
 * scheduled run continues where it left off.
 */

import { db, isLocalMode } from "../db.js";
import { telemetryRetentionPolicies, equipmentTelemetry, organizations } from "@shared/schema.js";
import { eq, lt, sql } from "drizzle-orm";
import { withTenantContext } from "../middleware/db-context.js";
import {
  dropExpiredPartitions,
  isEquipmentTelemetryPartitioned,
} from "../services/telemetry-partitioning/index.js";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("TelemetryRetention");

const DEFAULT_BATCH_SIZE = 10_000;
const DEFAULT_MAX_BATCHES_PER_RUN = 500;
const INTER_BATCH_SLEEP_MS = 50;

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetentionResult {
  success: boolean;
  deletedRecords: number;
  message: string;
  /** Whole monthly partitions dropped via the fast path (0 when unpartitioned). */
  partitionsDropped?: number;
  /** True when the per-run batch cap was hit; the next run continues. */
  exhausted?: boolean;
}

async function deleteExpiredRowsForOrg(
  orgId: string,
  cutoffDate: Date,
  batchSize: number,
  remainingBatches: number,
): Promise<{ deleted: number; batchesUsed: number; exhausted: boolean }> {
  let deleted = 0;
  let batchesUsed = 0;

  while (batchesUsed < remainingBatches) {
    const rowCount = await withTenantContext(orgId, async () => {
      const result = await db.execute(sql`
        DELETE FROM equipment_telemetry
        WHERE (org_id, ts, id) IN (
          SELECT org_id, ts, id FROM equipment_telemetry
          WHERE ts < ${cutoffDate}
          ORDER BY ts
          LIMIT ${batchSize}
        )
      `);
      return result.rowCount ?? 0;
    });

    batchesUsed++;
    deleted += rowCount;
    if (rowCount < batchSize) {
      return { deleted, batchesUsed, exhausted: false };
    }
    await sleep(INTER_BATCH_SLEEP_MS);
  }

  return { deleted, batchesUsed, exhausted: true };
}

export async function applyTelemetryRetention(): Promise<RetentionResult> {
  try {
    const policies = await db
      .select()
      .from(telemetryRetentionPolicies)
      .where(eq(telemetryRetentionPolicies.id, 1));
    if (policies.length === 0) {
      return {
        success: false,
        deletedRecords: 0,
        message: "No retention policy found. Create a policy first.",
      };
    }

    const policy = policies[0];
    const retentionDays = policy?.retentionDays ?? 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    if (isLocalMode) {
      // SQLite vessel mode: no RLS, no partitions, small datasets — the
      // original single-statement delete is the right tool.
      const result = await db
        .delete(equipmentTelemetry)
        .where(lt(equipmentTelemetry.ts, cutoffDate));
      const deletedRecords = result.rowCount ?? 0;
      return {
        success: true,
        deletedRecords,
        message: `Successfully deleted ${deletedRecords} telemetry records older than ${retentionDays} days`,
      };
    }

    // 1. Partition fast path: drop whole expired months before touching rows.
    let partitionsDropped = 0;
    if (await isEquipmentTelemetryPartitioned()) {
      partitionsDropped = await dropExpiredPartitions(cutoffDate);
      if (partitionsDropped > 0) {
        logger.info(`Dropped ${partitionsDropped} expired telemetry partitions`, {
          cutoff: cutoffDate.toISOString(),
        });
      }
    }

    // 2. Batched row deletes per org for whatever expired rows remain.
    const batchSize = intFromEnv("TELEMETRY_RETENTION_BATCH_SIZE", DEFAULT_BATCH_SIZE);
    const maxBatches = intFromEnv("TELEMETRY_RETENTION_MAX_BATCHES", DEFAULT_MAX_BATCHES_PER_RUN);

    const orgs = await db.select({ id: organizations.id }).from(organizations);

    let deletedRecords = 0;
    let batchesUsed = 0;
    let exhausted = false;

    for (const org of orgs) {
      if (batchesUsed >= maxBatches) {
        exhausted = true;
        break;
      }
      const orgResult = await deleteExpiredRowsForOrg(
        org.id,
        cutoffDate,
        batchSize,
        maxBatches - batchesUsed,
      );
      deletedRecords += orgResult.deleted;
      batchesUsed += orgResult.batchesUsed;
      exhausted = exhausted || orgResult.exhausted;
    }

    const suffix = exhausted
      ? ` (batch cap of ${maxBatches} reached — the next run continues)`
      : "";
    return {
      success: true,
      deletedRecords,
      partitionsDropped,
      exhausted,
      message:
        `Successfully deleted ${deletedRecords} telemetry records older than ${retentionDays} days` +
        (partitionsDropped > 0 ? ` and dropped ${partitionsDropped} expired partitions` : "") +
        suffix,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      deletedRecords: 0,
      message: `Failed to apply retention policy: ${message}`,
    };
  }
}

export async function getRetentionPolicy(): Promise<{
  retentionDays: number;
  rollupEnabled: boolean;
  compressionEnabled: boolean;
} | null> {
  try {
    const policies = await db
      .select()
      .from(telemetryRetentionPolicies)
      .where(eq(telemetryRetentionPolicies.id, 1));
    if (policies.length === 0) {
      return null;
    }
    const policy = policies[0];
    return {
      retentionDays: policy?.retentionDays ?? 365,
      rollupEnabled: policy?.rollupEnabled ?? false,
      compressionEnabled: policy?.compressionEnabled ?? false,
    };
  } catch {
    return null;
  }
}

export async function updateRetentionPolicy(
  retentionDays: number,
  rollupEnabled: boolean = true,
  compressionEnabled: boolean = false
): Promise<{ success: boolean; message: string }> {
  try {
    await db
      .insert(telemetryRetentionPolicies)
      .values({ id: 1, retentionDays, rollupEnabled, compressionEnabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: telemetryRetentionPolicies.id,
        set: { retentionDays, rollupEnabled, compressionEnabled, updatedAt: new Date() },
      });
    return {
      success: true,
      message: `Retention policy updated: ${retentionDays} days retention, rollup ${rollupEnabled ? "enabled" : "disabled"}, compression ${compressionEnabled ? "enabled" : "disabled"}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to update retention policy: ${message}`,
    };
  }
}
