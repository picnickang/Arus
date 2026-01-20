/**
 * ML Analytics Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseMlAnalyticsStorage } from "./db-ml-analytics.js";

import { DatabaseMlAnalyticsStorage } from "./db-ml-analytics.js";

export const dbMlAnalyticsStorage = new DatabaseMlAnalyticsStorage();

console.log("[ML Analytics Repository] Loaded 4 modular files");
