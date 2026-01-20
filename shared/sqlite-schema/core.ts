/**
 * SQLite Schema Core Module
 * Vessels, Equipment, Devices, Downtime Events
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const vesselsSqlite = sqliteTable(
  "vessels",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    imo: text("imo"),
    flag: text("flag"),
    vesselType: text("vessel_type"),
    vesselClass: text("vessel_class"),
    condition: text("condition").default("good"),
    onlineStatus: text("online_status").default("unknown"),
    lastHeartbeat: integer("last_heartbeat", { mode: "timestamp" }),
    dwt: integer("dwt"),
    yearBuilt: integer("year_built"),
    active: integer("active", { mode: "boolean" }).default(true),
    notes: text("notes"),
    dayRateSgd: real("day_rate_sgd"),
    downtimeDays: real("downtime_days").default(0),
    downtimeResetAt: integer("downtime_reset_at", { mode: "timestamp" }),
    operationDays: real("operation_days").default(0),
    operationResetAt: integer("operation_reset_at", { mode: "timestamp" }),
    lastDailyUpdateDate: text("last_daily_update_date"),
    commissionDate: integer("commission_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_vessels_org").on(table.orgId),
  })
);

export const equipmentSqlite = sqliteTable(
  "equipment",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    vesselName: text("vessel_name"),
    name: text("name").notNull(),
    plainLanguageName: text("plain_language_name"),
    type: text("type").notNull(),
    systemType: text("system_type"),
    componentType: text("component_type"),
    criticalityLevel: text("criticality_level").default("medium"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    location: text("location"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    specifications: text("specifications"),
    operatingParameters: text("operating_parameters"),
    maintenanceSchedule: text("maintenance_schedule"),
    emergencyLaborMultiplier: real("emergency_labor_multiplier"),
    emergencyPartsMultiplier: real("emergency_parts_multiplier"),
    emergencyDowntimeMultiplier: real("emergency_downtime_multiplier"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
    version: integer("version").default(1),
    lastModifiedBy: text("last_modified_by"),
    lastModifiedDevice: text("last_modified_device"),
  },
  (table) => ({
    orgIdx: index("idx_equipment_org").on(table.orgId),
    vesselIdx: index("idx_equipment_vessel").on(table.vesselId),
  })
);

export const devicesSqlite = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    label: text("label"),
    vessel: text("vessel"),
    buses: text("buses"),
    sensors: text("sensors"),
    config: text("config"),
    hmacKey: text("hmac_key"),
    deviceType: text("device_type").default("generic"),
    j1939Config: text("j1939_config"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_devices_org").on(table.orgId),
    equipmentIdx: index("idx_devices_equipment").on(table.equipmentId),
  })
);

export const downtimeEventsSqlite = sqliteTable(
  "downtime_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    workOrderId: text("work_order_id"),
    equipmentId: text("equipment_id"),
    vesselId: text("vessel_id"),
    downtimeType: text("downtime_type").notNull(),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }),
    durationHours: real("duration_hours"),
    reason: text("reason"),
    impactLevel: text("impact_level").default("medium"),
    revenueImpact: real("revenue_impact"),
    opportunityCost: real("opportunity_cost"),
    rootCause: text("root_cause"),
    preventable: integer("preventable", { mode: "boolean" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_downtime_org").on(table.orgId),
    workOrderIdx: index("idx_downtime_work_order").on(table.workOrderId),
    equipmentIdx: index("idx_downtime_equipment").on(table.equipmentId),
    vesselIdx: index("idx_downtime_vessel").on(table.vesselId),
    timeIdx: index("idx_downtime_time").on(table.startTime),
  })
);

export const equipmentLifecycleSqlite = sqliteTable(
  "equipment_lifecycle",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    installationDate: integer("installation_date", { mode: "timestamp" }),
    warrantyExpiry: integer("warranty_expiry", { mode: "timestamp" }),
    expectedLifespan: integer("expected_lifespan"),
    replacementCost: real("replacement_cost"),
    operatingHours: integer("operating_hours").default(0),
    maintenanceCount: integer("maintenance_count").default(0),
    lastMajorOverhaul: integer("last_major_overhaul", { mode: "timestamp" }),
    nextRecommendedReplacement: integer("next_recommended_replacement", { mode: "timestamp" }),
    condition: text("condition").notNull().default("good"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_el_equipment").on(table.equipmentId),
  })
);

export const performanceMetricsSqlite = sqliteTable(
  "performance_metrics",
  {
    id: text("id").primaryKey(),
    equipmentId: text("equipment_id").notNull(),
    metricDate: integer("metric_date", { mode: "timestamp" }).notNull(),
    efficiency: real("efficiency"),
    reliability: real("reliability"),
    availability: real("availability"),
    mtbfHours: real("mtbf_hours"),
    mttrHours: real("mttr_hours"),
    totalDowntimeMinutes: integer("total_downtime_minutes"),
    plannedDowntimeMinutes: integer("planned_downtime_minutes"),
    unplannedDowntimeMinutes: integer("unplanned_downtime_minutes"),
    operatingHours: real("operating_hours"),
    energyConsumption: real("energy_consumption"),
    performanceScore: real("performance_score"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_pm_equipment").on(table.equipmentId),
    dateIdx: index("idx_pm_date").on(table.metricDate),
  })
);
