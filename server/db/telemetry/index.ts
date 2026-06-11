/**
 * CANONICAL HOME — Telemetry
 * ============================================================
 * This module is the single canonical home for Telemetry data
 * access. Other layers (domain adapters under
 * `server/domains/telemetry/infrastructure/`, legacy route handlers,
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
 * Telemetry Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseTelemetryStorage } from "./db-telemetry.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Telemetry:Index");
import { DatabaseTelemetryStorage } from "./db-telemetry.js";

export const dbTelemetryStorage = new DatabaseTelemetryStorage();

logger.info("[Telemetry Repository] Loaded 4 modular files");
