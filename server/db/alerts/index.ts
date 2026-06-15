/**
 * CANONICAL HOME — Alerts
 * ============================================================
 * This module is the single canonical home for Alerts data
 * access. Other layers (domain adapters under
 * `server/domains/alerts/infrastructure/`, legacy route handlers,
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
 * Alerts Repository - Modular Aggregator
 */

export { DatabaseAlertStorage } from "./db-alerts.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Alerts:Index");
import { DatabaseAlertStorage } from "./db-alerts.js";

export const dbAlertStorage = new DatabaseAlertStorage();

logger.info("[Alerts Repository] Loaded 4 modular files");
