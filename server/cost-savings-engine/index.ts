/**
 * Cost Savings Engine Module - Public API
 */

export * from "./types";
export { calculateWorkOrderSavings } from "./calculator";
export {
  saveCostSavings,
  processWorkOrderCompletion,
  voidSavingsForWorkOrder,
  updateSavingsValidationStatus,
} from "./persistence";
export { getSavingsSummary, getMonthlySavingsTrend } from "./reporting";
export {
  getWorkOrderProcurementCosts,
  aggregateProcurementCostsToWorkOrder,
} from "./procurement-costs";
