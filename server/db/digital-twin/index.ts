/**
 * Digital Twin Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseDigitalTwinStorage } from "./db-digital-twin.js";

import { DatabaseDigitalTwinStorage } from "./db-digital-twin.js";

export const dbDigitalTwinStorage = new DatabaseDigitalTwinStorage();

console.log("[Digital Twin Repository] Loaded 4 modular files");
