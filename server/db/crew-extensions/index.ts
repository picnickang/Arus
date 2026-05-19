/**
   * CANONICAL HOME — Crew Extensions
   * ============================================================
   * This module is the single canonical home for Crew Extensions data
   * access. Other layers (domain adapters under
   * `server/domains/crew-extensions/infrastructure/`, legacy route handlers,
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
 * Crew Extensions Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbCrewExtensionsStorage } from "./db-crew-extensions.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:CrewExtensions:Index");
import { DbCrewExtensionsStorage } from "./db-crew-extensions.js";

export const dbCrewExtensionsStorage = new DbCrewExtensionsStorage();

logger.info("[Crew Extensions Repository] Loaded 3 modular files");
