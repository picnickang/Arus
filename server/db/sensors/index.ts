/**
   * CANONICAL HOME — Sensors
   * ============================================================
   * This module is the single canonical home for Sensors data
   * access. Other layers (domain adapters under
   * `server/domains/sensors/infrastructure/`, legacy route handlers,
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
 * Sensors Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbSensorsStorage } from "./db-sensors.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Sensors:Index");
import { DbSensorsStorage } from "./db-sensors.js";

export const dbSensorsStorage = new DbSensorsStorage();

logger.info("[Sensors Repository] Loaded 3 modular files");
