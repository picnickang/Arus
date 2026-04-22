/**
 * Condition Monitoring - Main Entry Point
 * Re-exports all types and functions
 */

export type { OilConditionAssessment, WearAssessment, ConditionTrend } from "./types.js";
export { assessOilCondition } from "./oil-assessment.js";
export { assessWearCondition } from "./wear-assessment.js";
export { generateConditionAssessment } from "./condition-assessment.js";
export {
  calculateOilQualityScore,
  calculateWearScore,
  generateMaintenanceRecommendations,
} from "./scoring.js";
