/**
 * GDPR Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseGdprStorage } from "./db-gdpr.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Gdpr:Index");
import { DatabaseGdprStorage } from "./db-gdpr.js";

export const dbGdprStorage = new DatabaseGdprStorage();

logger.info("[GDPR Repository] Loaded 4 modular files");
