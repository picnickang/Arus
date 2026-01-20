/**
 * Condition Monitoring - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type { OilConditionAssessment, WearAssessment, ConditionTrend } from "./condition-monitoring/index.js";

export {
  assessOilCondition,
  assessWearCondition,
  generateConditionAssessment,
  calculateOilQualityScore,
  calculateWearScore,
  generateMaintenanceRecommendations,
} from "./condition-monitoring/index.js";
