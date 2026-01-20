/**
 * STCW Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseStcwStorage } from "./db-stcw.js";

import { DatabaseStcwStorage } from "./db-stcw.js";

export const dbStcwStorage = new DatabaseStcwStorage();

console.log("[STCW Repository] Loaded 4 modular files");
