/**
 * Parquet exporter for one (orgId, UTC date) partition.
 *
 * Reads `1_hour` rollups from `telemetry_aggregated`, streams them to a
 * temp local `.parquet` file, then uploads to object storage at the
 * partitioned key. Idempotent: re-running for the same day overwrites
 * the same key with the same logical content (rows are ordered by
 * equipment_id, sensor_type, bucket_start).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";

import { ParquetSchema, ParquetWriter } from "@dsnp/parquetjs";

import { createLogger } from "../../lib/structured-logger";
import { objectStorageClient } from "../../replit_integrations/object_storage";
import { resolveWarehouseStorageTarget, warehouseObjectKey } from "./storage-config";
import type { WarehouseExportRunSummary } from "./types";

const logger = createLogger("TelemetryWarehouseExport:Parquet");

/**
 * Parquet schema — mirrors `telemetry_aggregated` columns the data team needs.
 * Keep types stable: any change here is a breaking schema bump for downstream
 * consumers (Athena/BigQuery external tables, Spark jobs, etc.).
 */
const PARQUET_SCHEMA = new ParquetSchema({
  org_id: { type: "UTF8" },
  equipment_id: { type: "UTF8" },
  sensor_type: { type: "UTF8" },
  bucket_start: { type: "TIMESTAMP_MILLIS" },
  bucket_size: { type: "UTF8" },
  count: { type: "INT64" },
  min_value: { type: "DOUBLE", optional: true },
  max_value: { type: "DOUBLE", optional: true },
  avg_value: { type: "DOUBLE", optional: true },
  stddev_value: { type: "DOUBLE", optional: true },
  p50_value: { type: "DOUBLE", optional: true },
  p95_value: { type: "DOUBLE", optional: true },
  p99_value: { type: "DOUBLE", optional: true },
  first_value: { type: "DOUBLE", optional: true },
  last_value: { type: "DOUBLE", optional: true },
});

interface RollupRow {
  org_id: string;
  equipment_id: string;
  sensor_type: string;
  bucket_start: Date;
  bucket_size: string;
  count: number;
  min_value: number | null;
  max_value: number | null;
  avg_value: number | null;
  stddev_value: number | null;
  p50_value: number | null;
  p95_value: number | null;
  p99_value: number | null;
  first_value: number | null;
  last_value: number | null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchRollups(db: unknown, orgId: string, dayStart: Date, dayEnd: Date): Promise<RollupRow[]> {
  // Cast `db` only at the call site — the rest of the module is strongly typed.
  const dbAny = db as { execute: (q: unknown) => Promise<{ rows?: Array<Record<string, unknown>> }> };
  const result = await dbAny.execute(sql`
    SELECT
      org_id, equipment_id, sensor_type, bucket_start, bucket_size,
      count, min_value, max_value, avg_value, stddev_value,
      p50_value, p95_value, p99_value, first_value, last_value
    FROM telemetry_aggregated
    WHERE org_id = ${orgId}
      AND bucket_size = '1_hour'
      AND bucket_start >= ${dayStart}
      AND bucket_start < ${dayEnd}
    ORDER BY equipment_id ASC, sensor_type ASC, bucket_start ASC
  `);

  const rows = result?.rows ?? [];
  return rows.map((r) => ({
    org_id: String(r['org_id']),
    equipment_id: String(r['equipment_id']),
    sensor_type: String(r['sensor_type']),
    bucket_start: r['bucket_start'] instanceof Date ? r['bucket_start'] : new Date(String(r['bucket_start'])),
    bucket_size: String(r['bucket_size']),
    count: Number(r['count'] ?? 0),
    min_value: toNumberOrNull(r['min_value']),
    max_value: toNumberOrNull(r['max_value']),
    avg_value: toNumberOrNull(r['avg_value']),
    stddev_value: toNumberOrNull(r['stddev_value']),
    p50_value: toNumberOrNull(r['p50_value']),
    p95_value: toNumberOrNull(r['p95_value']),
    p99_value: toNumberOrNull(r['p99_value']),
    first_value: toNumberOrNull(r['first_value']),
    last_value: toNumberOrNull(r['last_value']),
  }));
}

async function writeParquetFile(rows: RollupRow[], localPath: string): Promise<void> {
  // SNAPPY is the parquetjs default; pass via the loose options surface
  // since `compression` isn't included in the narrow WriterOptions typing.
  const writerOpts: unknown = { compression: "SNAPPY" };
  const writer = await ParquetWriter.openFile(
    PARQUET_SCHEMA,
    localPath,
    writerOpts as Parameters<typeof ParquetWriter.openFile>[2],
  );
  try {
    for (const row of rows) {
      const rowRecord: unknown = row;
      await writer.appendRow(rowRecord as Record<string, unknown>);
    }
  } finally {
    await writer.close();
  }
}

/**
 * List distinct orgIds that have any `1_hour` rollup in the given UTC day.
 * Bounds the work to orgs that actually have data — fleet-wide tables with
 * hundreds of orgs but only a handful active per day stay cheap.
 */
export async function listOrgIdsWithRollups(
  db: unknown,
  dayStart: Date,
  dayEnd: Date,
): Promise<string[]> {
  const dbAny = db as { execute: (q: unknown) => Promise<{ rows?: Array<Record<string, unknown>> }> };
  const result = await dbAny.execute(sql`
    SELECT DISTINCT org_id
    FROM telemetry_aggregated
    WHERE bucket_size = '1_hour'
      AND bucket_start >= ${dayStart}
      AND bucket_start < ${dayEnd}
    ORDER BY org_id ASC
  `);
  return (result?.rows ?? [])
    .map((r) => (typeof r['org_id'] === "string" ? r['org_id'] : String(r['org_id'])))
    .filter((s) => s.length > 0);
}

export interface ExportOrgDayInput {
  db: unknown;
  orgId: string;
  /** UTC midnight of the day being exported. */
  dayStart: Date;
  /** ISO date YYYY-MM-DD matching `dayStart`. */
  dateStr: string;
}

export async function exportOrgDayToParquet(
  input: ExportOrgDayInput,
): Promise<WarehouseExportRunSummary> {
  const { db, orgId, dayStart, dateStr } = input;
  const startedAt = new Date();
  const start = Date.now();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const objectKey = warehouseObjectKey(orgId, dateStr);

  try {
    const rows = await fetchRollups(db, orgId, dayStart, dayEnd);

    if (rows.length === 0) {
      const finishedAt = new Date();
      logger.info("No rollups for org/day — skipping", { orgId, date: dateStr });
      return {
        orgId,
        date: dateStr,
        status: "skipped-empty",
        rowCount: 0,
        sizeBytes: 0,
        durationMs: Date.now() - start,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
    }

    // Stage to a unique temp file so concurrent runs (shouldn't happen,
    // but defensively) can't tear each other's output.
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "arus-warehouse-"));
    const tmpFile = path.join(
      tmpDir,
      `part-${randomBytes(4).toString("hex")}.parquet`,
    );

    try {
      await writeParquetFile(rows, tmpFile);
      const stat = await fs.promises.stat(tmpFile);

      const target = resolveWarehouseStorageTarget();
      const bucket = objectStorageClient.bucket(target.bucketName);
      // upload() options include `metadata` at runtime but the narrow v7
      // typings expose only `destination`; widen via Parameters<>.
      const uploadOpts: unknown = {
        destination: objectKey,
        metadata: {
          contentType: "application/vnd.apache.parquet",
          metadata: {
            orgId,
            date: dateStr,
            rowCount: String(rows.length),
            bucketSize: "1_hour",
            schemaVersion: "1",
            exportedAt: startedAt.toISOString(),
          },
        },
      };
      await bucket.upload(tmpFile, uploadOpts as Parameters<typeof bucket.upload>[1]);

      const finishedAt = new Date();
      logger.info("Exported telemetry rollups to warehouse", {
        orgId,
        date: dateStr,
        rowCount: rows.length,
        sizeBytes: stat.size,
        parquetKey: objectKey,
        durationMs: finishedAt.getTime() - start,
      });

      return {
        orgId,
        date: dateStr,
        status: "exported",
        rowCount: rows.length,
        sizeBytes: stat.size,
        durationMs: finishedAt.getTime() - start,
        parquetKey: objectKey,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    const finishedAt = new Date();
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Telemetry warehouse export failed", {
      orgId,
      date: dateStr,
      parquetKey: objectKey,
      error: errorMessage,
    });
    return {
      orgId,
      date: dateStr,
      status: "failed",
      rowCount: 0,
      sizeBytes: 0,
      durationMs: finishedAt.getTime() - start,
      errorMessage,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  }
}
