/**
 * Engine Log Auto-Fill Service - Index Aggregator
 * Combines all modular auto-fill functionality
 * 
 * Modularized into 8 files:
 * - types.ts (~95 lines): Type definitions and interfaces
 * - logging.ts (~30 lines): Structured logging utilities
 * - mappings.ts (~85 lines): Telemetry to field mappings
 * - thresholds.ts (~80 lines): Anomaly detection thresholds
 * - telemetry-fetcher.ts (~95 lines): Batch telemetry fetching
 * - fmcc-integration.ts (~130 lines): Aquametro FMCC integration
 * - engine-autofill.ts (~185 lines): Main engine auto-fill
 * - generator-autofill.ts (~130 lines): Generator auto-fill
 * - analytics.ts (~95 lines): Anomaly and unsigned log analytics
 */

export * from "./types.js";
export { log } from "./logging.js";
export { DEFAULT_TELEMETRY_MAPPING, GENERATOR_TELEMETRY_MAPPING } from "./mappings.js";
export { ENGINE_ANOMALY_THRESHOLDS, GENERATOR_ANOMALY_THRESHOLDS, checkAnomaly } from "./thresholds.js";
export { batchFetchTelemetry, aggregateTelemetryByHour } from "./telemetry-fetcher.js";
export { fetchFMCCFuelForDay, updateDailyLogWithFMCCFuel } from "./fmcc-integration.js";
export { autoFillFromTelemetry } from "./engine-autofill.js";
export { autoFillGeneratorsFromTelemetry } from "./generator-autofill.js";
export { getAnomalySummary, getUnsignedLogs } from "./analytics.js";

import { autoFillFromTelemetry } from "./engine-autofill.js";
import { autoFillGeneratorsFromTelemetry } from "./generator-autofill.js";
import { getAnomalySummary, getUnsignedLogs } from "./analytics.js";
import { checkAnomaly } from "./thresholds.js";
import { ENGINE_ANOMALY_THRESHOLDS, GENERATOR_ANOMALY_THRESHOLDS } from "./thresholds.js";

export default {
  autoFillFromTelemetry,
  autoFillGeneratorsFromTelemetry,
  getAnomalySummary,
  getUnsignedLogs,
  checkAnomaly,
  ENGINE_ANOMALY_THRESHOLDS,
  GENERATOR_ANOMALY_THRESHOLDS,
};
