/**
 * Vessels Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseVesselStorage } from "./db-vessels.js";

import { DatabaseVesselStorage } from "./db-vessels.js";

export const dbVesselStorage = new DatabaseVesselStorage();

console.log("[Vessels Repository] Loaded 4 modular files");
