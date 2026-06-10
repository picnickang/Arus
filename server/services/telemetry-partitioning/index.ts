/**
 * Telemetry partition maintenance for the natively partitioned
 * `equipment_telemetry` table (migrations/0038).
 *
 * The table is RANGE-partitioned on `ts` into monthly children named
 * `equipment_telemetry_yYYYYmMM`, plus an `equipment_telemetry_default`
 * DEFAULT partition as a safety net for out-of-range timestamps. All
 * helpers here are catalog-driven and idempotent, and degrade to no-ops
 * when the table is not (yet) partitioned, so callers do not need to
 * know whether 0038 has been applied.
 *
 * Partition DDL is not subject to row-level security; only the
 * row-moving fallback in `ensureFutureMonthlyPartitions` touches rows,
 * and it moves them between children of the same parent without
 * filtering, which is safe under any tenant context.
 */

import { sql } from "drizzle-orm";
import { db, isLocalMode } from "../../db.js";
import { createLogger } from "../../lib/structured-logger";

const logger = createLogger("TelemetryPartitioning");

export const PARENT_TABLE = "equipment_telemetry";
export const DEFAULT_PARTITION = "equipment_telemetry_default";

/** Strict allow-list for identifiers we splice into DDL via sql.raw(). */
const PARTITION_NAME_PATTERN = /^equipment_telemetry_(y\d{4}m\d{2}|default)$/;

export interface PartitionInfo {
  name: string;
  /** Upper bound (exclusive) of the partition's ts range; null for DEFAULT. */
  upperBound: Date | null;
  isDefault: boolean;
}

export function partitionNameForMonth(monthStart: Date): string {
  const y = monthStart.getUTCFullYear().toString().padStart(4, "0");
  const m = (monthStart.getUTCMonth() + 1).toString().padStart(2, "0");
  return `equipment_telemetry_y${y}m${m}`;
}

export function monthStartUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonthsUTC(monthStart: Date, months: number): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + months, 1));
}

function toSqlTimestamp(d: Date): string {
  // equipment_telemetry.ts is `timestamp` (no tz); bounds are written as
  // naive UTC wall-clock values, matching how the app writes Date values.
  return d.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Parse the upper bound out of pg_get_expr(relpartbound) output, e.g.
 *   FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00')
 * Returns null for the DEFAULT partition (bound expr is `DEFAULT`).
 * Exported for unit tests.
 */
export function parsePartitionUpperBound(boundExpr: string): Date | null {
  if (/^\s*DEFAULT\s*$/i.test(boundExpr)) {
    return null;
  }
  const match = boundExpr.match(/TO\s*\('([^']+)'\)/i);
  if (!match?.[1]) {
    return null;
  }
  const parsed = new Date(`${match[1].replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function isEquipmentTelemetryPartitioned(): Promise<boolean> {
  if (isLocalMode) {
    // SQLite vessel mode has no pg_catalog and no partitioning.
    return false;
  }
  const result = await db.execute(sql`
    SELECT c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relname = ${PARENT_TABLE}
  `);
  const rows = result.rows as Array<{ relkind: string }>;
  return rows[0]?.relkind === "p";
}

export async function listPartitions(): Promise<PartitionInfo[]> {
  const result = await db.execute(sql`
    SELECT child.relname AS name,
           pg_get_expr(child.relpartbound, child.oid) AS bound
    FROM pg_inherits i
    JOIN pg_class parent ON parent.oid = i.inhparent
    JOIN pg_class child ON child.oid = i.inhrelid
    JOIN pg_namespace n ON n.oid = parent.relnamespace
    WHERE n.nspname = current_schema() AND parent.relname = ${PARENT_TABLE}
    ORDER BY child.relname
  `);
  return (result.rows as Array<{ name: string; bound: string }>).map((row) => ({
    name: row.name,
    upperBound: parsePartitionUpperBound(row.bound),
    isDefault: /^\s*DEFAULT\s*$/i.test(row.bound),
  }));
}

/**
 * Partitions whose entire ts range is older than `cutoff` (upper bound
 * <= cutoff). The DEFAULT partition is never eligible.
 * Exported for unit tests via the pure selection helper below.
 */
export function selectExpiredPartitions(
  partitions: PartitionInfo[],
  cutoff: Date
): PartitionInfo[] {
  return partitions.filter(
    (p) => !p.isDefault && p.upperBound !== null && p.upperBound.getTime() <= cutoff.getTime()
  );
}

export async function listExpiredPartitions(cutoff: Date): Promise<PartitionInfo[]> {
  return selectExpiredPartitions(await listPartitions(), cutoff);
}

function assertSafePartitionName(name: string): void {
  if (!PARTITION_NAME_PATTERN.test(name)) {
    throw new Error(`Refusing DDL on unexpected partition name: ${name}`);
  }
}

/**
 * Ensure monthly partitions exist from the current month through
 * now()+monthsAhead, plus the DEFAULT safety net. Idempotent.
 *
 * If a CREATE fails because the DEFAULT partition already holds rows in
 * the new month's range (PostgreSQL validates on create), fall back to
 * the standard recipe in one transaction: detach DEFAULT, create the
 * month partition, move the in-range rows back through the parent
 * (conflict-skipped on the natural key), re-attach DEFAULT.
 */
export async function ensureFutureMonthlyPartitions(
  monthsAhead = 3,
  now: Date = new Date()
): Promise<{ created: string[]; movedFromDefault: number }> {
  const created: string[] = [];
  let movedFromDefault = 0;

  if (!(await isEquipmentTelemetryPartitioned())) {
    return { created, movedFromDefault };
  }

  const existing = new Set((await listPartitions()).map((p) => p.name));
  let month = monthStartUTC(now);
  const lastMonth = addMonthsUTC(month, monthsAhead);

  while (month.getTime() <= lastMonth.getTime()) {
    const name = partitionNameForMonth(month);
    const next = addMonthsUTC(month, 1);
    if (!existing.has(name)) {
      assertSafePartitionName(name);
      const from = toSqlTimestamp(month);
      const to = toSqlTimestamp(next);
      try {
        await db.execute(
          sql.raw(
            `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF ${PARENT_TABLE} ` +
              `FOR VALUES FROM ('${from}') TO ('${to}')`
          )
        );
        created.push(name);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/default partition/i.test(message)) {
          throw err;
        }
        logger.warn(
          `DEFAULT partition holds rows in ${name}'s range — detaching to carve the month out`
        );
        movedFromDefault += await carveMonthOutOfDefault(name, from, to);
        created.push(name);
      }
    }
    month = next;
  }

  return { created, movedFromDefault };
}

async function carveMonthOutOfDefault(name: string, from: string, to: string): Promise<number> {
  assertSafePartitionName(name);
  let moved = 0;
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`ALTER TABLE ${PARENT_TABLE} DETACH PARTITION ${DEFAULT_PARTITION}`));
    await tx.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF ${PARENT_TABLE} ` +
          `FOR VALUES FROM ('${from}') TO ('${to}')`
      )
    );
    const inserted = await tx.execute(
      sql.raw(
        `INSERT INTO ${PARENT_TABLE} (id, org_id, ts, equipment_id, sensor_type, value, unit, threshold, status, idempotency_key) ` +
          `SELECT id, org_id, ts, equipment_id, sensor_type, value, unit, threshold, status, idempotency_key ` +
          `FROM ${DEFAULT_PARTITION} WHERE ts >= '${from}' AND ts < '${to}' ` +
          `ON CONFLICT (org_id, equipment_id, sensor_type, ts) DO NOTHING`
      )
    );
    await tx.execute(
      sql.raw(`DELETE FROM ${DEFAULT_PARTITION} WHERE ts >= '${from}' AND ts < '${to}'`)
    );
    await tx.execute(
      sql.raw(`ALTER TABLE ${PARENT_TABLE} ATTACH PARTITION ${DEFAULT_PARTITION} DEFAULT`)
    );
    moved = inserted.rowCount ?? 0;
  });
  return moved;
}

/**
 * Detach + drop every partition wholly older than `cutoff`. Uses
 * DETACH CONCURRENTLY (PG14+) on a bare autocommit statement so readers
 * are not blocked; falls back to a plain DETACH when CONCURRENTLY is
 * unavailable. Returns the number of partitions dropped.
 */
export async function dropExpiredPartitions(cutoff: Date): Promise<number> {
  if (!(await isEquipmentTelemetryPartitioned())) {
    return 0;
  }
  const expired = await listExpiredPartitions(cutoff);
  let dropped = 0;
  for (const partition of expired) {
    assertSafePartitionName(partition.name);
    try {
      await db.execute(
        sql.raw(`ALTER TABLE ${PARENT_TABLE} DETACH PARTITION ${partition.name} CONCURRENTLY`)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        `DETACH CONCURRENTLY failed for ${partition.name} (${message}) — retrying plain DETACH`
      );
      await db.execute(sql.raw(`ALTER TABLE ${PARENT_TABLE} DETACH PARTITION ${partition.name}`));
    }
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${partition.name}`));
    dropped++;
    logger.info(`Dropped expired telemetry partition ${partition.name}`);
  }
  return dropped;
}

/** Row count in the DEFAULT partition — non-zero means a partition gap existed. */
export async function countDefaultPartitionRows(): Promise<number> {
  if (!(await isEquipmentTelemetryPartitioned())) {
    return 0;
  }
  const result = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${DEFAULT_PARTITION}`));
  const rows = result.rows as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
