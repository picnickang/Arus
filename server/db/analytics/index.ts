/**
 * Analytics Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseAnalyticsStorage } from "./db-analytics.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Analytics:Index");
import { DatabaseAnalyticsStorage } from "./db-analytics.js";

export const dbAnalyticsStorage = new DatabaseAnalyticsStorage();

logger.info("[Analytics Repository] Loaded 4 modular files");
