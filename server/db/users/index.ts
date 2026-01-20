/**
 * Users Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseUserStorage } from "./db-users.js";

import { DatabaseUserStorage } from "./db-users.js";

export const dbUserStorage = new DatabaseUserStorage();

console.log("[Users Repository] Loaded 4 modular files");
