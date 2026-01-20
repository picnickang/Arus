/**
 * Crew Extensions Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbCrewExtensionsStorage } from "./db-crew-extensions.js";

import { DbCrewExtensionsStorage } from "./db-crew-extensions.js";

export const dbCrewExtensionsStorage = new DbCrewExtensionsStorage();

console.log("[Crew Extensions Repository] Loaded 3 modular files");
