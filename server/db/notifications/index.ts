/**
 * Notifications Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseNotificationsStorage } from "./db-notifications.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Notifications:Index");
import { DatabaseNotificationsStorage } from "./db-notifications.js";

export const dbNotificationsStorage = new DatabaseNotificationsStorage();

logger.info("[Notifications Repository] Loaded 4 modular files");
