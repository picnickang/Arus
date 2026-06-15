/**
 * CANONICAL HOME — Users
 * ============================================================
 * This module is the single canonical home for Users data
 * access. Other layers (domain adapters under
 * `server/domains/users/infrastructure/`, legacy route handlers,
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
 * Users Repository - Modular Aggregator
 */

export { DatabaseUserStorage } from "./db-users.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Users:Index");
import { DatabaseUserStorage } from "./db-users.js";

export const dbUserStorage = new DatabaseUserStorage();

logger.info("[Users Repository] Loaded 4 modular files");
