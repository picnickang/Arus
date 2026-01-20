/**
 * Equipment Repository - Modular Aggregator
 */

export * from "./types.js";
export { setWebSocketServer, getWebSocketServer } from "./websocket.js";
export { DatabaseEquipmentStorage } from "./db-equipment.js";

import { DatabaseEquipmentStorage } from "./db-equipment.js";

export const dbEquipmentStorage = new DatabaseEquipmentStorage();

console.log("[Equipment Repository] Loaded 5 modular files");
