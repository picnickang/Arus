/**
 * Optimizer Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbOptimizerStorage } from "./db-optimizer.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Optimizer:Index");
import { DbOptimizerStorage } from "./db-optimizer.js";

export const dbOptimizerStorage = new DbOptimizerStorage();

logger.info("[Optimizer Repository] Loaded 4 modular files");
