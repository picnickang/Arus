/**
 * Condition Monitoring Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbConditionMonitoringStorage } from "./db-condition-monitoring.js";

import { DbConditionMonitoringStorage } from "./db-condition-monitoring.js";

export const dbConditionMonitoringStorage = new DbConditionMonitoringStorage();

console.log("[Condition Monitoring Repository] Loaded 3 modular files");
