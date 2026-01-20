/**
 * Optimizer Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbOptimizerStorage } from "./db-optimizer.js";

import { DbOptimizerStorage } from "./db-optimizer.js";

export const dbOptimizerStorage = new DbOptimizerStorage();

console.log("[Optimizer Repository] Loaded 4 modular files");
