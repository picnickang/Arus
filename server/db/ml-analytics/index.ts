/**
 * ML Analytics Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseMlAnalyticsStorage } from "./db-ml-analytics.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:MlAnalytics:Index");
import { DatabaseMlAnalyticsStorage } from "./db-ml-analytics.js";

export const dbMlAnalyticsStorage = new DatabaseMlAnalyticsStorage();

logger.info("[ML Analytics Repository] Loaded 4 modular files");
