/**
 * Storage Kernel - Aggregates all domain repositories for delegation
 * This provides a single entry point for all storage operations
 * 
 * UPDATED: Imports from modular directories instead of deprecated *.repo.ts files
 * Migration completed: Q4 2025
 */

// Modular repository imports (preferred - direct from modular directories)
export { dbEquipmentStorage } from "../db/equipment/index.js";
export { dbVesselStorage } from "../db/vessels/index.js";
export { dbAlertStorage } from "../db/alerts/index.js";
export { dbTelemetryStorage } from "../db/telemetry/index.js";
export { dbMaintenanceStorage } from "../db/maintenance/index.js";
export { dbWorkOrderStorage } from "../db/workorders/index.js";
export { dbCrewStorage } from "../db/crew/index.js";
export { dbOptimizerStorage } from "../db/optimizer/index.js";
export { dbInventoryStorage } from "../db/inventory/index.js";
export { dbAnalyticsStorage } from "../db/analytics/index.js";
export { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";
export { dbSensorsStorage } from "../db/sensors/index.js";
export { dbSystemAdminStorage } from "../db/system-admin/index.js";
export { dbUserStorage } from "../db/users/index.js";
export { dbDtcStorage } from "../db/dtc/index.js";
export { dbDigitalTwinStorage } from "../db/digital-twin/index.js";
export { dbChecklistsStorage } from "../db/checklists/index.js";
export { dbNotificationsStorage } from "../db/notifications/index.js";
export { dbHubSyncStorage } from "../db/hub-sync/index.js";
export { dbSchedulerStorage } from "../db/scheduler/index.js";
export { dbLogbooksStorage } from "../db/logbooks/index.js";
export { dbMaintenanceTemplatesStorage } from "../db/maintenance-templates/index.js";
export { dbConditionMonitoringStorage } from "../db/condition-monitoring/index.js";
export { dbOperatingConditionsStorage } from "../db/operating-conditions/index.js";
export { dbStcwStorage } from "../db/stcw/index.js";
export { dbCrewExtensionsStorage } from "../db/crew-extensions/index.js";
export { dbGdprStorage } from "../db/gdpr/index.js";
export { dbStormGeoStorage } from "../db/stormgeo/index.js";

// Logbook adapters (domain-specific)
export { DatabaseDeckLogStorage } from "./domains/logbook/deck-log-storage.js";
export { DatabaseEngineLogStorage } from "./domains/logbook/engine-log-storage.js";
