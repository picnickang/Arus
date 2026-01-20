/**
 * Condition Log Service - Backward Compatible Shim
 * Delegates to modular files in ./condition-log/
 */

export type { ConditionLogResult, ConditionPeriodData } from "./condition-log/index.js";
export { ConditionLogService, conditionLogService } from "./condition-log/index.js";
