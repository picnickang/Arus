/**
   * CANONICAL HOME — Gdpr
   * ============================================================
   * This module is the single canonical home for Gdpr data
   * access. Other layers (domain adapters under
   * `server/domains/gdpr/infrastructure/`, legacy route handlers,
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
 * GDPR Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseGdprStorage } from "./db-gdpr.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Gdpr:Index");
import { DatabaseGdprStorage } from "./db-gdpr.js";

export const dbGdprStorage = new DatabaseGdprStorage();

logger.info("[GDPR Repository] Loaded 4 modular files");
