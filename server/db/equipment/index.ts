/**
 * Equipment Repository - Modular Aggregator
 */

export * from "./types.js";
export { setWebSocketServer, getWebSocketServer } from "./websocket.js";
export { DatabaseEquipmentStorage } from "./db-equipment.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Equipment:Index");
import { DatabaseEquipmentStorage } from "./db-equipment.js";

export const dbEquipmentStorage = new DatabaseEquipmentStorage();

logger.info("[Equipment Repository] Loaded 5 modular files");
