/**
 * Analytics Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseAnalyticsStorage } from "./db-analytics.js";

import { DatabaseAnalyticsStorage } from "./db-analytics.js";

export const dbAnalyticsStorage = new DatabaseAnalyticsStorage();

console.log("[Analytics Repository] Loaded 4 modular files");
