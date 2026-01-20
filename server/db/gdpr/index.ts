/**
 * GDPR Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseGdprStorage } from "./db-gdpr.js";

import { DatabaseGdprStorage } from "./db-gdpr.js";

export const dbGdprStorage = new DatabaseGdprStorage();

console.log("[GDPR Repository] Loaded 4 modular files");
