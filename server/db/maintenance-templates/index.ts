/**
 * Maintenance Templates Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseMaintenanceTemplatesStorage } from "./db-maintenance-templates.js";

import { DatabaseMaintenanceTemplatesStorage } from "./db-maintenance-templates.js";

export const dbMaintenanceTemplatesStorage = new DatabaseMaintenanceTemplatesStorage();

console.log("[Maintenance Templates Repository] Loaded 4 modular files");
