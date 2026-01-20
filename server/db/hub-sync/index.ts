/**
 * Hub Sync Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseHubSyncStorage } from "./db-hub-sync.js";

import { DatabaseHubSyncStorage } from "./db-hub-sync.js";

export const dbHubSyncStorage = new DatabaseHubSyncStorage();

console.log("[Hub Sync Repository] Loaded 4 modular files");
