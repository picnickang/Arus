/**
 * CANONICAL HOME — Dtc
 * ============================================================
 * This module is the single canonical home for Dtc data
 * access. Other layers (domain adapters under
 * `server/domains/dtc/infrastructure/`, legacy route handlers,
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
 * DTC Repository - Modular Aggregator
 */

export { DatabaseDtcStorage } from "./db-dtc.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Dtc:Index");
import { DatabaseDtcStorage } from "./db-dtc.js";

export const dbDtcStorage = new DatabaseDtcStorage();

logger.info("[DTC Repository] Loaded 4 modular files");
