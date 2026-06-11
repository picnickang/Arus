/**
 * CANONICAL HOME — Checklists
 * ============================================================
 * This module is the single canonical home for Checklists data
 * access. Other layers (domain adapters under
 * `server/domains/checklists/infrastructure/`, legacy route handlers,
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
 * Checklists Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseChecklistsStorage } from "./db-checklists.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Checklists:Index");
import { DatabaseChecklistsStorage } from "./db-checklists.js";

export const dbChecklistsStorage = new DatabaseChecklistsStorage();

logger.info("[Checklists Repository] Loaded 4 modular files");
