/**
 * Crew Extensions Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbCrewExtensionsStorage } from "./db-crew-extensions.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:CrewExtensions:Index");
import { DbCrewExtensionsStorage } from "./db-crew-extensions.js";

export const dbCrewExtensionsStorage = new DbCrewExtensionsStorage();

logger.info("[Crew Extensions Repository] Loaded 3 modular files");
