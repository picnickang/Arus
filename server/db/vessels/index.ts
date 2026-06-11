/**
 * CANONICAL HOME — Vessels
 * ============================================================
 * This module is the single canonical home for Vessels data
 * access. Other layers (domain adapters under
 * `server/domains/vessels/infrastructure/`, legacy route handlers,
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
 * Vessels Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseVesselStorage } from "./db-vessels.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Vessels:Index");
import { DatabaseVesselStorage } from "./db-vessels.js";

export const dbVesselStorage = new DatabaseVesselStorage();

logger.info("[Vessels Repository] Loaded 4 modular files");
