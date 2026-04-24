/**
 * Hub Sync Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseHubSyncStorage } from "./db-hub-sync.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:HubSync:Index");
import { DatabaseHubSyncStorage } from "./db-hub-sync.js";

export const dbHubSyncStorage = new DatabaseHubSyncStorage();

logger.info("[Hub Sync Repository] Loaded 4 modular files");
