/**
 * DTC Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseDtcStorage } from "./db-dtc.js";

import { DatabaseDtcStorage } from "./db-dtc.js";

export const dbDtcStorage = new DatabaseDtcStorage();

console.log("[DTC Repository] Loaded 4 modular files");
