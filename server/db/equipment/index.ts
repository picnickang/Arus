/**
 * CANONICAL HOME — Equipment
 * ============================================================
 * This module is the single canonical home for Equipment data
 * access. Other layers (domain adapters under
 * `server/domains/equipment/infrastructure/`, legacy route handlers,
 * cross-domain readers in `server/composition/*`, etc.) MUST import
 * the `db…Storage` singleton from this file directly rather than
 * routing through `server/repositories.ts`. Push B4 (Repositories
 * Proxy Decomposition) removed the four primary-domain importers of
 * that proxy; the proxy now exists only as a transitional re-export
 * barrel for legacy non-domain consumers. New code MUST import from
 * here.
 * ============================================================
 */
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
