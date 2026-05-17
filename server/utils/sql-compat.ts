// @ts-nocheck
/**
 * SQL Compatibility Layer
 * Provides database-agnostic query helpers for PostgreSQL and SQLite
 */

import { sql } from "drizzle-orm";
import { isLocalMode } from "../db-config";

/**
 * Check if running in SQLite mode (vessel deployment)
 */
export function isSQLiteMode(): boolean {
  return isLocalMode;
}

/**
 * Get JSON extract expression for database type
 * PostgreSQL uses -> or ->> operators, SQLite uses json_extract()
 */
export function jsonExtract(column: string, path: string): any {
  if (isSQLiteMode()) {
    // SQLite: json_extract(column, '$.path')
    return sql`json_extract(${sql.raw(column)}, ${path})`;
  }
  // PostgreSQL: column->>'key'
  const key = path.replace("$.", "");
  return sql`${sql.raw(column)}->>${key}`;
}

/**
 * Get JSON array aggregate for database type
 * PostgreSQL uses jsonb_agg(), SQLite uses json_group_array()
 */
export function jsonArrayAgg(column: string): any {
  if (isSQLiteMode()) {
    return sql`json_group_array(${sql.raw(column)})`;
  }
  return sql`jsonb_agg(${sql.raw(column)})`;
}

/**
 * Get JSON object aggregate for database type
 * PostgreSQL uses jsonb_build_object(), SQLite uses json_object()
 */
export function jsonBuildObject(pairs: Record<string, any>): any {
  const entries = Object.entries(pairs);

  if (isSQLiteMode()) {
    const args = entries.flatMap(([k, v]) => [sql.literal(k), v]);
    return sql`json_object(${sql.join(args, sql`, `)})`;
  }
  // PostgreSQL: keys must be SQL string literals
  const args = entries.flatMap(([k, v]) => [sql.literal(k), v]);
  return sql`jsonb_build_object(${sql.join(args, sql`, `)})`;
}

/**
 * Convert JSONB column type for database
 * PostgreSQL uses jsonb, SQLite uses text with JSON validation
 */
export function getJSONColumnType(): "jsonb" | "text" {
  return isSQLiteMode() ? "text" : "jsonb";
}

/**
 * Get timestamp column type for database
 * PostgreSQL uses timestamp, SQLite uses integer (Unix epoch)
 */
export function getTimestampColumnType(): "timestamp" | "integer" {
  return isSQLiteMode() ? "integer" : "timestamp";
}

/**
 * CTE (Common Table Expression) compatibility check
 * SQLite has limited CTE support in older versions
 */
export function supportsCTE(): boolean {
  // Both PostgreSQL and modern SQLite support CTEs
  return true;
}

/**
 * Convert timestamp for database storage
 */
export function convertTimestamp(date: Date): number | Date {
  if (isSQLiteMode()) {
    return date.getTime(); // Unix timestamp for SQLite
  }
  return date; // Native timestamp for PostgreSQL
}

/**
 * Parse timestamp from database
 */
export function parseTimestamp(value: number | Date | string): Date {
  if (typeof value === "number") {
    return new Date(value); // SQLite Unix timestamp
  }

  if (value instanceof Date) {
    return value; // PostgreSQL Date object
  }
  return new Date(value); // String ISO date
}

/**
 * Case-insensitive LIKE operator
 * PostgreSQL uses ILIKE, SQLite uses LIKE with COLLATE NOCASE
 */
export function ilike(column: any, pattern: string): any {
  if (isSQLiteMode()) {
    // SQLite: column LIKE pattern COLLATE NOCASE
    return sql`${column} LIKE ${pattern} COLLATE NOCASE`;
  }
  // PostgreSQL: column ILIKE pattern
  return sql`${column} ILIKE ${pattern}`;
}

/**
 * Array containment check
 * PostgreSQL uses @> operator, SQLite uses JSON-aware containment
 *
 * Important: This assumes arrays are stored as JSON strings in SQLite
 */
export function arrayContains(column: any, value: string): any {
  if (isSQLiteMode()) {
    // SQLite: Use JSON functions for accurate array containment
    // Check if value exists in JSON array using json_each
    return sql`EXISTS (
      SELECT 1 FROM json_each(${column}) 
      WHERE json_each.value = ${value}
    )`;
  }
  // PostgreSQL: column @> ARRAY[value]
  return sql`${column} @> ARRAY[${value}]::text[]`;
}

/**
 * Update JSONB field
 * PostgreSQL uses jsonb_set, SQLite uses json_set
 *
 * Path format translation:
 * - PostgreSQL: '{key}' or '{key,subkey}'
 * - SQLite: '$.key' or '$.key.subkey'
 *
 * Note: Pass raw values (strings, numbers) - the function handles serialization
 */
export function jsonSet(column: any, path: string, value: any): any {
  if (isSQLiteMode()) {
    // SQLite: Convert PostgreSQL path {key,subkey} to $.key.subkey
    const sqlitePath = path
      .replace(/^\{/, "$.") // Replace leading { with $.
      .replace(/\}$/, "") // Remove trailing }
      .replaceAll(",", "."); // Replace commas with dots

    // SQLite json_set accepts raw values directly
    return sql`json_set(COALESCE(${column}, '{}'), ${sqlitePath}, ${value})`;
  }
  // PostgreSQL: jsonb_set requires to_jsonb() wrapper for proper type conversion
  return sql`jsonb_set(COALESCE(${column}, '{}'::jsonb), ${path}, to_jsonb(${value}))`;
}

/**
 * Check if TimescaleDB features are available
 * Only true for PostgreSQL with TimescaleDB extension
 */
export function supportsTimescaleDB(): boolean {
  // TimescaleDB is PostgreSQL-only
  return !isSQLiteMode();
}

/**
 * Check if materialized views are supported
 * Only true for PostgreSQL
 */
export function supportsMaterializedViews(): boolean {
  return !isSQLiteMode();
}
