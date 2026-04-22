/**
 * Data Export/Import Constants
 *
 * Version information and entity configuration for exports.
 */

export const CURRENT_EXPORT_VERSION = 2;
export const CURRENT_SCHEMA_VERSION = "2025-11-26";
export const TELEMETRY_CHUNK_SIZE = 10000;

/**
 * Entity export order - parent entities must come before children
 * to ensure proper FK relationship mapping during import.
 */
export const ENTITY_EXPORT_ORDER = [
  "organizations",
  "vessels",
  "equipment",
  "devices",
  "users",
  "crew",
  "crew_certifications",
  "crew_assignments",
  "sensor_configurations",
  "alert_configurations",
  "maintenance_schedules",
  "work_orders",
  "work_order_completions",
  "maintenance_records",
  "alert_notifications",
  "pdm_score_logs",
  "parts_inventory",
  "system_settings",
  "kb_docs",
] as const;

/**
 * Telemetry entities - exported in chunks due to large size
 */
export const TELEMETRY_ENTITIES = ["equipment_telemetry", "raw_telemetry"] as const;

/**
 * Foreign key mappings - defines relationships between entities
 * Format: { entityName: { fieldName: mappingSource } }
 */
export const FK_MAPPINGS: Record<string, Record<string, string>> = {
  equipment: { vesselId: "vessels" },
  sensors: { vesselId: "vessels", equipmentId: "equipment" },
  work_orders: { vesselId: "vessels", equipmentId: "equipment" },
  maintenance_schedules: { vesselId: "vessels", equipmentId: "equipment" },
  alert_configurations: { vesselId: "vessels", equipmentId: "equipment" },
  telemetry_readings: { vesselId: "vessels", equipmentId: "equipment" },
  telemetry_normalized: { vesselId: "vessels", equipmentId: "equipment" },
  telemetry_timeseries: { vesselId: "vessels", equipmentId: "equipment" },
  pdm_scores: { equipmentId: "equipment" },
  maintenance_predictions: { equipmentId: "equipment" },
};

/**
 * Date fields that need to be converted during import
 */
export const DATE_FIELDS = [
  "createdAt",
  "updatedAt",
  "ts",
  "timestamp",
  "plannedStartDate",
  "plannedEndDate",
  "actualStartDate",
  "actualEndDate",
  "completedAt",
  "dueDate",
  "lastMaintenanceDate",
  "nextDueDate",
  "issuedDate",
  "expiryDate",
  "startDate",
  "endDate",
  "vesselDowntimeStartedAt",
  "vesselDowntimeEndedAt",
  "resolvedAt",
  "acknowledgedAt",
  "lastSyncAt",
  "syncedAt",
  "lastUpdatedAt",
] as const;

export type EntityName = (typeof ENTITY_EXPORT_ORDER)[number];
export type TelemetryEntityName = (typeof TELEMETRY_ENTITIES)[number];
