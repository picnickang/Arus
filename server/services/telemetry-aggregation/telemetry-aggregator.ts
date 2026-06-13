/**
 * Telemetry Aggregation Service
 *
 * GAP FILL #4: Pre-computes time-bucketed aggregates so historical queries
 * don't hit raw telemetry tables with millions of rows.
 *
 * Problem: Querying 6 months of 1-second telemetry = ~15 million rows per sensor.
 * Fleet-wide analytics become unusably slow.
 *
 * Solution: Scheduled aggregation into 1-minute, 1-hour, and 1-day buckets.
 * Queries automatically route to the most efficient bucket for the requested
 * time range.
 *
 * If you're using TimescaleDB, use continuous aggregates instead of this service.
 * This service is for standard PostgreSQL.
 *
 * Usage:
 *   const aggregator = new TelemetryAggregator(db);
 *   await aggregator.aggregateRange(orgId, start, end, '1_hour');  // Build hourly rollups
 *   const data = await aggregator.queryAggregated(orgId, equipmentId, sensorType, start, end);
 *   // Automatically picks the right bucket size for the time range
 */

import { logger } from "../../utils/logger";

const LOG_CTX = "TelemetryAggregation";

// ============================================================================
// Types
// ============================================================================

type BucketSize = "1_minute" | "1_hour" | "1_day";

interface AggregatedReading {
  equipmentId: string;
  sensorType: string;
  bucketStart: Date;
  bucketSize: BucketSize;
  count: number;
  min: number;
  max: number;
  avg: number;
  stddev: number;
  p50: number; // median
  p95: number;
  p99: number;
  first: number;
  last: number;
}

interface AggregationResult {
  bucketsCreated: number;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  bucketSize: BucketSize;
  durationMs: number;
}

// ============================================================================
// SQL for creating the aggregation table (run once via migration)
// ============================================================================

export const AGGREGATION_TABLE_SQL = `
-- Telemetry aggregation table for pre-computed rollups
-- Run this as a migration before using the TelemetryAggregator service.

CREATE TABLE IF NOT EXISTS telemetry_aggregated (
  id              SERIAL PRIMARY KEY,
  org_id          TEXT NOT NULL,
  equipment_id    TEXT NOT NULL,
  sensor_type     TEXT NOT NULL,
  bucket_start    TIMESTAMPTZ NOT NULL,
  bucket_size     TEXT NOT NULL CHECK (bucket_size IN ('1_minute', '1_hour', '1_day')),
  count           INTEGER NOT NULL DEFAULT 0,
  min_value       DOUBLE PRECISION,
  max_value       DOUBLE PRECISION,
  avg_value       DOUBLE PRECISION,
  stddev_value    DOUBLE PRECISION,
  p50_value       DOUBLE PRECISION,
  p95_value       DOUBLE PRECISION,
  p99_value       DOUBLE PRECISION,
  first_value     DOUBLE PRECISION,
  last_value      DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, equipment_id, sensor_type, bucket_start, bucket_size)
);

-- Indexes for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_telemetry_agg_lookup
  ON telemetry_aggregated (org_id, equipment_id, sensor_type, bucket_size, bucket_start);

CREATE INDEX IF NOT EXISTS idx_telemetry_agg_time
  ON telemetry_aggregated (org_id, bucket_size, bucket_start);
`;

// ============================================================================
// Bucket size selection logic
// ============================================================================

function selectBucketSize(startDate: Date, endDate: Date): BucketSize {
  const rangeMs = endDate.getTime() - startDate.getTime();
  const rangeHours = rangeMs / (1000 * 60 * 60);

  if (rangeHours <= 2) {
    return "1_minute";
  } // ≤2 hours: 1-minute buckets
  if (rangeHours <= 72) {
    return "1_hour";
  } // ≤3 days: 1-hour buckets
  return "1_day"; // >3 days: 1-day buckets
}

function getBucketIntervalMs(bucket: BucketSize): number {
  switch (bucket) {
    case "1_minute":
      return 60 * 1000;
    case "1_hour":
      return 60 * 60 * 1000;
    case "1_day":
      return 24 * 60 * 60 * 1000;
  }
}

function getBucketTruncSQL(bucket: BucketSize): string {
  switch (bucket) {
    case "1_minute":
      return "minute";
    case "1_hour":
      return "hour";
    case "1_day":
      return "day";
  }
}

// ============================================================================
// Main Service
// ============================================================================

type AggregatorDb = {
  execute: (q: import("drizzle-orm").SQLWrapper) => Promise<{
    rows?: Array<Record<string, unknown>>;
    rowCount?: number | null;
  }>;
};

export function canEnsureAggregationTable(db: unknown): db is AggregatorDb {
  return Boolean(db && typeof (db as { execute?: unknown }).execute === "function");
}

export class TelemetryAggregator {
  private db: AggregatorDb;

  constructor(db: AggregatorDb) {
    this.db = db;
  }

  /**
   * Create the aggregation table if it doesn't exist.
   * Call this on startup or as part of a migration.
   */
  async ensureTable(): Promise<void> {
    try {
      const { sql } = await import("drizzle-orm");
      await this.db.execute(sql.raw(AGGREGATION_TABLE_SQL));
      logger.info(LOG_CTX, "Aggregation table ensured");
    } catch (error) {
      logger.error(LOG_CTX, "Failed to create aggregation table", error);
      throw error;
    }
  }

  /**
   * Aggregate telemetry into pre-computed buckets for a time range, reading
   * BOTH sources: `raw_telemetry` (manual imports) and `equipment_telemetry`
   * (the batch-writer's live ingest table — previously never aggregated, so
   * ingested data was invisible to rollups and the warehouse export).
   * Designed to be called by a scheduled job (e.g., every hour for hourly
   * rollups). Both tables carry FORCE RLS — callers must run this under the
   * org's tenant context or the reads silently return zero rows in prod.
   *
   * Uses INSERT ... ON CONFLICT UPDATE so it's idempotent — safe to re-run.
   */
  async aggregateRange(
    orgId: string,
    startDate: Date,
    endDate: Date,
    bucketSize: BucketSize
  ): Promise<AggregationResult> {
    const startTime = Date.now();
    const truncFn = getBucketTruncSQL(bucketSize);

    logger.info(
      LOG_CTX,
      `Aggregating ${bucketSize} buckets from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      { orgId }
    );

    try {
      const { sql } = await import("drizzle-orm");
      // The trunc unit must be inlined, not bound: a bound `date_trunc($1, ts)`
      // in SELECT and `date_trunc($9, ts)` in GROUP BY are *different* parse
      // nodes to PostgreSQL, which rejects the statement with `column "ts"
      // must appear in the GROUP BY clause` — every sweep failed this way
      // until now. Safe to inline: truncFn is the closed getBucketTruncSQL
      // enum ('minute' | 'hour' | 'day'), never caller input.
      const truncUnit = sql.raw(`'${truncFn}'`);
      const result = await this.db.execute(sql`
        INSERT INTO telemetry_aggregated (
          org_id, equipment_id, sensor_type, bucket_start, bucket_size,
          count, min_value, max_value, avg_value, stddev_value,
          p50_value, p95_value, p99_value, first_value, last_value
        )
        SELECT
          org_id,
          equipment_id,
          sensor_type,
          date_trunc(${truncUnit}, ts) AS bucket_start,
          ${bucketSize} AS bucket_size,
          COUNT(*) AS count,
          MIN(value) AS min_value,
          MAX(value) AS max_value,
          AVG(value) AS avg_value,
          STDDEV(value) AS stddev_value,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value) AS p50_value,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) AS p95_value,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) AS p99_value,
          (ARRAY_AGG(value ORDER BY ts ASC))[1] AS first_value,
          (ARRAY_AGG(value ORDER BY ts DESC))[1] AS last_value
        FROM (
          -- Disjoint sources, so UNION ALL cannot double-count a reading:
          -- raw_telemetry holds manual imports (vessel/sig naming);
          -- equipment_telemetry is the batch-writer's live ingest table.
          -- Filters are pushed into each branch so the hot table's scan
          -- stays partition-pruned (RANGE(ts), migrations/0038) and both
          -- reads stay on their (org_id, ts) indexes.
          SELECT org_id, vessel AS equipment_id, sig AS sensor_type, ts, value
          FROM raw_telemetry
          WHERE org_id = ${orgId}
            AND ts >= ${startDate}
            AND ts < ${endDate}
            AND value IS NOT NULL
          UNION ALL
          SELECT org_id, equipment_id, sensor_type, ts, value
          FROM equipment_telemetry
          WHERE org_id = ${orgId}
            AND ts >= ${startDate}
            AND ts < ${endDate}
            AND value IS NOT NULL
        ) AS telemetry_sources
        GROUP BY org_id, equipment_id, sensor_type, date_trunc(${truncUnit}, ts)
        ON CONFLICT (org_id, equipment_id, sensor_type, bucket_start, bucket_size)
        DO UPDATE SET
          count = EXCLUDED.count,
          min_value = EXCLUDED.min_value,
          max_value = EXCLUDED.max_value,
          avg_value = EXCLUDED.avg_value,
          stddev_value = EXCLUDED.stddev_value,
          p50_value = EXCLUDED.p50_value,
          p95_value = EXCLUDED.p95_value,
          p99_value = EXCLUDED.p99_value,
          first_value = EXCLUDED.first_value,
          last_value = EXCLUDED.last_value,
          created_at = NOW()
      `);

      const bucketsCreated = result?.rowCount ?? 0;
      const durationMs = Date.now() - startTime;

      logger.info(
        LOG_CTX,
        `Aggregated ${bucketsCreated} ${bucketSize} buckets in ${durationMs}ms`,
        { orgId }
      );

      return {
        bucketsCreated,
        timeRangeStart: startDate,
        timeRangeEnd: endDate,
        bucketSize,
        durationMs,
      };
    } catch (error) {
      logger.error(LOG_CTX, `Aggregation failed for ${bucketSize}`, error);
      throw error;
    }
  }

  /**
   * Query aggregated telemetry data. Automatically selects the most efficient
   * bucket size for the requested time range.
   *
   * Returns pre-computed min/max/avg/p95/p99 per bucket — orders of magnitude
   * faster than querying raw telemetry.
   */
  async queryAggregated(
    orgId: string,
    equipmentId: string,
    sensorType: string,
    startDate: Date,
    endDate: Date,
    forceBucket?: BucketSize
  ): Promise<AggregatedReading[]> {
    const bucket = forceBucket ?? selectBucketSize(startDate, endDate);

    try {
      const { sql } = await import("drizzle-orm");
      const rows = await this.db.execute(sql`
        SELECT
          equipment_id, sensor_type, bucket_start, bucket_size,
          count, min_value, max_value, avg_value, stddev_value,
          p50_value, p95_value, p99_value, first_value, last_value
        FROM telemetry_aggregated
        WHERE org_id = ${orgId}
          AND equipment_id = ${equipmentId}
          AND sensor_type = ${sensorType}
          AND bucket_size = ${bucket}
          AND bucket_start >= ${startDate}
          AND bucket_start < ${endDate}
        ORDER BY bucket_start ASC
      `);

      return (rows?.rows ?? []).map((raw: Record<string, unknown>) => {
        const row = raw as {
          equipment_id: string;
          sensorType: string;
          bucket_start: string | Date;
          bucket_size: BucketSize;
          count: number;
          min_value: number;
          max_value: number;
          avg_value: number;
          stddev_value: number;
          p50_value: number;
          p95_value: number;
          p99_value: number;
          first_value: number;
          last_value: number;
        };
        return {
          equipmentId: row.equipment_id,
          sensorType: row.sensorType,
          bucketStart: new Date(row.bucket_start),
          bucketSize: row.bucket_size,
          count: row.count,
          min: row.min_value,
          max: row.max_value,
          avg: row.avg_value,
          stddev: row.stddev_value,
          p50: row.p50_value,
          p95: row.p95_value,
          p99: row.p99_value,
          first: row.first_value,
          last: row.last_value,
        };
      });
    } catch (error) {
      logger.error(LOG_CTX, "Aggregated query failed, falling back to raw telemetry", error);
      // Fallback: return empty so caller can try raw query
      return [];
    }
  }

  /**
   * Run all aggregation levels for the last N hours.
   * Designed for a scheduled job that runs every hour.
   */
  async runScheduledAggregation(
    orgId: string,
    lookbackHours = 2
  ): Promise<{
    minute: AggregationResult;
    hour: AggregationResult;
    day: AggregationResult;
  }> {
    const now = new Date();
    const minuteStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
    const hourStart = new Date(now.getTime() - 25 * 60 * 60 * 1000); // Last 25 hours (overlap for safety)
    const dayStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // Last 2 days

    const [minute, hour, day] = await Promise.all([
      this.aggregateRange(orgId, minuteStart, now, "1_minute"),
      this.aggregateRange(orgId, hourStart, now, "1_hour"),
      this.aggregateRange(orgId, dayStart, now, "1_day"),
    ]);

    return { minute, hour, day };
  }

  /**
   * Clean up old aggregation data to prevent unbounded growth.
   * Keeps 1-minute data for 7 days, 1-hour for 90 days, 1-day forever.
   */
  async cleanupOldAggregations(): Promise<{ minuteDeleted: number; hourDeleted: number }> {
    const { sql } = await import("drizzle-orm");

    const minuteCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hourCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const minuteResult = await this.db.execute(
      sql`DELETE FROM telemetry_aggregated WHERE bucket_size = '1_minute' AND bucket_start < ${minuteCutoff}`
    );

    const hourResult = await this.db.execute(
      sql`DELETE FROM telemetry_aggregated WHERE bucket_size = '1_hour' AND bucket_start < ${hourCutoff}`
    );

    const minuteDeleted = minuteResult?.rowCount ?? 0;
    const hourDeleted = hourResult?.rowCount ?? 0;

    logger.info(
      LOG_CTX,
      `Cleanup: removed ${minuteDeleted} minute + ${hourDeleted} hour aggregations`
    );
    return { minuteDeleted, hourDeleted };
  }
}
