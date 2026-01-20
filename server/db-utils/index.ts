/**
 * Database Utils - Main Entry Point
 * Re-exports all types and functions
 */

export type { DatabaseHealth } from "./types.js";
export { getDatabaseHealth } from "./health.js";
export { enableTimescaleDB, createHypertable, createContinuousAggregate, enableCompression } from "./timescale.js";
export { applyTelemetryRetention, getRetentionPolicy, updateRetentionPolicy } from "./retention.js";
export { getCurrentSchemaVersion, recordSchemaVersion } from "./schema-version.js";
