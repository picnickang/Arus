/**
 * Condition Monitoring Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbConditionMonitoringStorage } from "./db-condition-monitoring.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:ConditionMonitoring:Index");
import { DbConditionMonitoringStorage } from "./db-condition-monitoring.js";

export const dbConditionMonitoringStorage = new DbConditionMonitoringStorage();

logger.info("[Condition Monitoring Repository] Loaded 3 modular files");
