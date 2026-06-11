/**
 * CANONICAL HOME — Digital Twin
 * ============================================================
 * This module is the single canonical home for Digital Twin data
 * access. Other layers (domain adapters under
 * `server/domains/digital-twin/infrastructure/`, legacy route handlers,
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
 * Digital Twin Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseDigitalTwinStorage } from "./db-digital-twin.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:DigitalTwin:Index");
import { DatabaseDigitalTwinStorage } from "./db-digital-twin.js";

export const dbDigitalTwinStorage = new DatabaseDigitalTwinStorage();

logger.info("[Digital Twin Repository] Loaded 4 modular files");
