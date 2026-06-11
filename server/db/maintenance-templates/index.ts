/**
 * CANONICAL HOME — Maintenance Templates
 * ============================================================
 * This module is the single canonical home for Maintenance Templates data
 * access. Other layers (domain adapters under
 * `server/domains/maintenance-templates/infrastructure/`, legacy route handlers,
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
 * Maintenance Templates Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseMaintenanceTemplatesStorage } from "./db-maintenance-templates.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:MaintenanceTemplates:Index");
import { DatabaseMaintenanceTemplatesStorage } from "./db-maintenance-templates.js";

export const dbMaintenanceTemplatesStorage = new DatabaseMaintenanceTemplatesStorage();

logger.info("[Maintenance Templates Repository] Loaded 4 modular files");
