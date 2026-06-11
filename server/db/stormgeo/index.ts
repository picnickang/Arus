/**
 * CANONICAL HOME — Stormgeo
 * ============================================================
 * This module is the single canonical home for Stormgeo data
 * access. Other layers (domain adapters under
 * `server/domains/stormgeo/infrastructure/`, legacy route handlers,
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
 * StormGeo Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseStormGeoStorage } from "./db-stormgeo.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Stormgeo:Index");
import { DatabaseStormGeoStorage } from "./db-stormgeo.js";

export const dbStormGeoStorage = new DatabaseStormGeoStorage();

logger.info("[StormGeo Repository] Loaded 4 modular files");
