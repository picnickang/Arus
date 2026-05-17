// @ts-nocheck
/**
 * Safe SQL Execution Helper
 *
 * Provides mode-aware SQL execution that works in both cloud (PostgreSQL/libSQL)
 * and vessel (SQLite) deployment modes.
 *
 * Use this instead of raw `db.execute()` calls for dual-mode compatibility.
 */

import { SQL, sql as drizzleSql } from "drizzle-orm";
import { hasPostgresFeatures, isVesselMode } from "../config/runtimeEnv";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Utils:SafeSql");

export interface SafeSqlOptions {
  /** Skip execution in vessel mode instead of attempting fallback */
  skipInVesselMode?: boolean;

  /** Log message when skipping in vessel mode */
  skipMessage?: string;
}

interface DrizzleDbLike {
  execute(query: SQL): Promise<{ rows?: unknown[]; rowCount?: number }>;
  all?(query: SQL): Promise<unknown[]>;
  get?(query: SQL): Promise<unknown>;
}

/**
 * Execute SQL safely across deployment modes
 *
 * @param db - Drizzle database instance
 * @param sqlQuery - SQL query to execute
 * @param options - Execution options
 * @returns Query result or empty object if skipped
 *
 * @example
 * // Cloud-only operation (skip in vessel mode)
 * await safeSql(db, sql`SELECT * FROM hypertables`, {
 *   skipInVesselMode: true,
 *   skipMessage: "TimescaleDB query skipped in SQLite mode"
 * });
 *
 * @example
 * // Dual-mode operation (use fallback in vessel mode)
 * const result = await safeSql(db, sql`SELECT 1 as health_check`);
 */
export async function safeSql<T = unknown>(
  db: DrizzleDbLike,
  sqlQuery: SQL,
  options: SafeSqlOptions = {}
): Promise<{ rows?: T[]; rowCount?: number }> {
  const { skipInVesselMode = false, skipMessage } = options;

  // Route based on deployment mode:
  // PostgreSQL/Neon (CLOUD) → db.execute() (standard Drizzle API)
  // SQLite/libSQL (VESSEL) → db.all()/db.get() (SQLite-specific API)
  if (hasPostgresFeatures) {
    // CLOUD mode: PostgreSQL/Neon uses db.execute()
    return db.execute(sqlQuery);
  }

  // VESSEL mode: handle based on options
  if (isVesselMode && skipInVesselMode) {
    if (skipMessage) {
      logger.info(`[SafeSQL] ${skipMessage}`);
    }
    return { rows: [], rowCount: 0 };
  }

  // VESSEL mode: use SQLite-compatible methods
  try {
    // Attempt to use db.all() for SELECT queries (SQLite)
    const result = await db.all(sqlQuery);
    return { rows: result, rowCount: result?.length || 0 };
  } catch {
    // If db.all() fails, try db.get() for single-row queries
    try {
      const result = await db.get(sqlQuery);
      return { rows: result ? [result] : [], rowCount: result ? 1 : 0 };
    } catch (innerError) {
      logger.error("[SafeSQL] Error executing SQLite query:", undefined, innerError);
      return { rows: [], rowCount: 0 };
    }
  }
}

/**
 * Execute raw SQL string safely (for SET LOCAL, RESET commands, etc.)
 * Only works in PostgreSQL mode, silently skips in SQLite mode
 */
export async function safeRawSql(
  db: DrizzleDbLike,
  rawSqlString: string,
  options: SafeSqlOptions = {}
): Promise<void> {
  const { skipMessage } = options;

  // PostgreSQL mode: use db.execute() with raw SQL
  if (hasPostgresFeatures) {
    await db.execute(drizzleSql.raw(rawSqlString));
    return;
  }

  // SQLite/Vessel mode: skip (raw SQL commands like SET LOCAL don't work in SQLite)
  if (skipMessage || process.env.NODE_ENV === "development") {
    logger.info(`[SafeSQL] Raw SQL skipped in SQLite mode: ${skipMessage || rawSqlString.substring(0, 50)}`);
  }
}

/**
 * Check if db.execute() is available for raw SQL
 * Useful for conditional logic based on database capabilities
 */
export function canExecuteRawSql(): boolean {
  return hasPostgresFeatures;
}
