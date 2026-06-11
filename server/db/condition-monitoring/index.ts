/**
 * CANONICAL HOME — Condition Monitoring
 * ============================================================
 * This module is the single canonical home for Condition Monitoring data
 * access. Other layers (domain adapters under
 * `server/domains/condition-monitoring/infrastructure/`, legacy route handlers,
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
 * Condition Monitoring Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbConditionMonitoringStorage } from "./db-condition-monitoring.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:ConditionMonitoring:Index");
import { DbConditionMonitoringStorage } from "./db-condition-monitoring.js";

export const dbConditionMonitoringStorage = new DbConditionMonitoringStorage();

logger.info("[Condition Monitoring Repository] Loaded 3 modular files");
