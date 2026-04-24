/**
 * Users Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseUserStorage } from "./db-users.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Users:Index");
import { DatabaseUserStorage } from "./db-users.js";

export const dbUserStorage = new DatabaseUserStorage();

logger.info("[Users Repository] Loaded 4 modular files");
