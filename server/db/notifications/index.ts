/**
 * Notifications Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseNotificationsStorage } from "./db-notifications.js";

import { DatabaseNotificationsStorage } from "./db-notifications.js";

export const dbNotificationsStorage = new DatabaseNotificationsStorage();

console.log("[Notifications Repository] Loaded 4 modular files");
