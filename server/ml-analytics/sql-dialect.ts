/**
 * Dialect-aware SQL fragments for the ML-analytics telemetry aggregations.
 *
 * The statistical engine buckets telemetry by hour. Postgres (cloud) uses
 * `date_trunc('hour', …)` + a `::float8` cast; SQLite (vessel/embedded) has
 * neither, so it uses `strftime` over the integer epoch-seconds `ts` column.
 *
 * We branch on `runtimeEnv.isLocalMode` — the real deployment-mode flag — rather
 * than the schema-runtime `IS_POSTGRES`, because the jest harness mocks
 * `@shared/schema-runtime` to the Postgres schema (IS_POSTGRES === true) even
 * when the embedded SQLite database is active. `isLocalMode` tracks the actual
 * `db` handle in both production and tests.
 */
import { sql, type SQL, type AnyColumn } from "drizzle-orm";

import { isLocalMode } from "../config/runtimeEnv";

/** Truncate a timestamp column to the start of its hour. */
export function hourBucketExpr(tsColumn: AnyColumn): SQL {
  return isLocalMode
    ? sql`strftime('%Y-%m-%d %H:00:00', ${tsColumn}, 'unixepoch')`
    : sql`date_trunc('hour', ${tsColumn})`;
}

/** Average a numeric column, coercing to float8 on Postgres. */
export function hourlyAvg(valueColumn: AnyColumn): SQL<number> {
  return isLocalMode ? sql<number>`avg(${valueColumn})` : sql<number>`avg(${valueColumn})::float8`;
}
