/**
 * Logbooks Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseLogbooksStorage } from "./db-logbooks.js";

import { DatabaseLogbooksStorage } from "./db-logbooks.js";

export const dbLogbooksStorage = new DatabaseLogbooksStorage();

console.log("[Logbooks Repository] Loaded 4 modular files");
