/**
 * Sync Jobs - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type { DataIssue, ReconciliationResult, CheckResult } from "./sync-jobs/index.js";

export {
  reconcileAll,
  checkPartsStockAlignment,
  checkReservationOverflow,
  checkWorkOrdersPendingOnPO,
  checkCrewCertificationExpiry,
  checkSensorThresholdConflicts,
  rollupDailyMetric,
  getReconciliationSummary,
} from "./sync-jobs/index.js";
