/**
 * STCW Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseStcwStorage } from "./db-stcw.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Stcw:Index");
import { DatabaseStcwStorage } from "./db-stcw.js";

export const dbStcwStorage = new DatabaseStcwStorage();

logger.info("[STCW Repository] Loaded 4 modular files");
