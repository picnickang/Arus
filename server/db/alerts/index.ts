/**
 * Alerts Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseAlertStorage } from "./db-alerts.js";

import { DatabaseAlertStorage } from "./db-alerts.js";

export const dbAlertStorage = new DatabaseAlertStorage();

console.log("[Alerts Repository] Loaded 4 modular files");
