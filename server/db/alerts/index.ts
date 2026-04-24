/**
 * Alerts Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseAlertStorage } from "./db-alerts.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Alerts:Index");
import { DatabaseAlertStorage } from "./db-alerts.js";

export const dbAlertStorage = new DatabaseAlertStorage();

logger.info("[Alerts Repository] Loaded 4 modular files");
