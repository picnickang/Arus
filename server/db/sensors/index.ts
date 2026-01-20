/**
 * Sensors Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbSensorsStorage } from "./db-sensors.js";

import { DbSensorsStorage } from "./db-sensors.js";

export const dbSensorsStorage = new DbSensorsStorage();

console.log("[Sensors Repository] Loaded 3 modular files");
