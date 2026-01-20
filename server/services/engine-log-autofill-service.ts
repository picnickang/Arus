/**
 * Engine Log Auto-Fill Service
 * 
 * BACKWARD COMPATIBILITY SHIM
 * This file re-exports from the modular engine-log-autofill/ directory.
 * New code should import directly from './engine-log-autofill/index.js'
 * 
 * Modularized into 9 files:
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

export {
  AutoFillServiceError,
  DEFAULT_TELEMETRY_MAPPING,
  GENERATOR_TELEMETRY_MAPPING,
  ENGINE_ANOMALY_THRESHOLDS,
  GENERATOR_ANOMALY_THRESHOLDS,
  checkAnomaly,
  batchFetchTelemetry,
  aggregateTelemetryByHour,
  fetchFMCCFuelForDay,
  updateDailyLogWithFMCCFuel,
  autoFillFromTelemetry,
  autoFillGeneratorsFromTelemetry,
  getAnomalySummary,
  getUnsignedLogs,
} from "./engine-log-autofill/index.js";

export type {
  LogContext,
  TelemetryAggregate,
  AutoFillResult,
  FMCCFuelResult,
  AutoFillSummary,
  AnomalyThreshold,
  AutoFillOptions,
  GeneratorAutoFillOptions,
  AnomalySummary,
  UnsignedLogInfo,
} from "./engine-log-autofill/index.js";

export { default } from "./engine-log-autofill/index.js";
