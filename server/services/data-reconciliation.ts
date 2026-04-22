/**
 * Data Reconciliation Service - Backward Compatible Shim
 * Delegates to modular files in ./data-reconciliation/
 */

export type {
  ReconciliationIssue,
  ReconciliationReport,
  ReconciliationSummary,
  ValidationResult,
  ReconciliationStatus,
} from "./data-reconciliation/index.js";
export {
  reconciliationMetrics,
  DataReconciliationService,
  dataReconciliationService,
} from "./data-reconciliation/index.js";
