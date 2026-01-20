/**
 * StormGeo Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseStormGeoStorage } from "./db-stormgeo.js";

import { DatabaseStormGeoStorage } from "./db-stormgeo.js";

export const dbStormGeoStorage = new DatabaseStormGeoStorage();

console.log("[StormGeo Repository] Loaded 4 modular files");
