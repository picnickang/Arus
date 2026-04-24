/**
 * Checklists Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseChecklistsStorage } from "./db-checklists.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Checklists:Index");
import { DatabaseChecklistsStorage } from "./db-checklists.js";

export const dbChecklistsStorage = new DatabaseChecklistsStorage();

logger.info("[Checklists Repository] Loaded 4 modular files");
