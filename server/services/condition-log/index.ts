/**
 * Condition Log Service - Modular Exports
 */

export type { ConditionLogResult, ConditionPeriodData, VibrationAggregation, ConditionAggregation, VesselConditionSummary } from "./types.js";
export { getHealthGrade, getConditionRating, calculateDegradationRate, estimateRUL } from "./health-utils.js";
export { aggregateVibrationData, aggregateConditionData, getMonitoredEquipment } from "./aggregators.js";
export { getPreviousHealthIndex, createConditionLogEntry } from "./entry-creator.js";
export { getConditionLogHistory, getVesselConditionSummary } from "./queries.js";
export { ConditionLogService, conditionLogService } from "./service.js";
