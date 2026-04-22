/**
 * STCW Compliance Module - Public API
 */

export * from "./types";
export {
  chunksFromDay,
  restHoursInWindow,
  normalizeRestDays,
  countRestHours,
  countWorkHours,
  findLongestRestBlock,
} from "./rest-utils";
export { checkMonthCompliance } from "./compliance-checker";
export {
  calculateFatigueMetrics,
  calculateFatigueRisk,
  calculateVesselFatigueSummary,
} from "./fatigue-risk";
