/**
 * Checklists Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseChecklistsStorage } from "./db-checklists.js";

import { DatabaseChecklistsStorage } from "./db-checklists.js";

export const dbChecklistsStorage = new DatabaseChecklistsStorage();

console.log("[Checklists Repository] Loaded 4 modular files");
