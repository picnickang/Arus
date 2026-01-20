/**
 * Operating Conditions Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbOperatingConditionsStorage } from "./db-operating-conditions.js";

import { DbOperatingConditionsStorage } from "./db-operating-conditions.js";

export const dbOperatingConditionsStorage = new DbOperatingConditionsStorage();

console.log("[Operating Conditions Repository] Loaded 3 modular files");
