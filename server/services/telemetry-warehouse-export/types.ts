/**
 * Telemetry Warehouse Export — shared types.
 *
 * Task #95 — daily export of rolled-up telemetry to object storage as
 * partitioned Parquet so the data team can run ad-hoc analytics
 * directly out of the warehouse instead of hitting the app database.
 *
 * Partition layout (object storage):
 *   <privatePrefix>/telemetry-warehouse/orgId=<orgId>/date=YYYY-MM-DD/part-0001.parquet
 *   <privatePrefix>/telemetry-warehouse/orgId=<orgId>/_manifest.json
 *
 * Each Parquet file holds the `1_hour` rollups for a single (orgId, UTC date)
 * pair — never cross-tenant — and is overwrite-idempotent: re-running the same
 * day produces the same key with the same logical content (rows ordered by
 * equipment_id, sensor_type, bucket_start).
 *
 * Compression: SNAPPY (parquetjs default; balances size vs. CPU).
 * Schema is documented in `parquet-exporter.ts` alongside the writer.
 */

export interface WarehouseExportEntry {
  /** ISO date (YYYY-MM-DD, UTC) the rows belong to. */
  date: string;
  /** Object-storage key (under PRIVATE_OBJECT_DIR) for the Parquet file. */
  parquetKey: string;
  /** Number of `1_hour` rollup rows written. */
  rowCount: number;
  /** ISO timestamp the export was last written. */
  exportedAt: string;
  /** Bytes on object storage (best-effort; -1 if unknown). */
  sizeBytes: number;
}

export interface WarehouseManifest {
  orgId: string;
  updatedAt: string;
  exports: WarehouseExportEntry[];
}

export interface WarehouseExportRunSummary {
  orgId: string;
  /** UTC date string the export covered (the "previous day"). */
  date: string;
  status: "exported" | "skipped-empty" | "failed";
  rowCount: number;
  sizeBytes: number;
  durationMs: number;
  parquetKey?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
}

export interface WarehouseExportJobSummary {
  /** UTC date the run covered. */
  date: string;
  orgsTotal: number;
  orgsExported: number;
  orgsSkipped: number;
  orgsFailed: number;
  rowsExported: number;
  bytesExported: number;
  retentionDeleted: number;
  durationMs: number;
  perOrg: WarehouseExportRunSummary[];
}
