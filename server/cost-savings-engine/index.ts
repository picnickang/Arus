/**
 * Cost Savings Engine Module - Public API
 */

export * from "./types";
export { calculateWorkOrderSavings } from "./calculator";
export { saveCostSavings, processWorkOrderCompletion } from "./persistence";
export { getSavingsSummary, getMonthlySavingsTrend } from "./reporting";
