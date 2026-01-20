/**
 * Database Utils - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type { DatabaseHealth } from "./db-utils/index.js";

export {
  getDatabaseHealth,
  enableTimescaleDB,
  createHypertable,
  createContinuousAggregate,
  enableCompression,
  applyTelemetryRetention,
  getRetentionPolicy,
  updateRetentionPolicy,
  getCurrentSchemaVersion,
  recordSchemaVersion,
} from "./db-utils/index.js";
