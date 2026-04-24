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
