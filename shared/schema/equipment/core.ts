/**
 * Equipment registry, edge device, lifecycle, and decommission schema tables.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  numeric,
  timestamp,
  boolean,
  jsonb,
  unique,
  index,
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
  versionTracking,
} from "../base";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { suppliers, parts } from "../inventory";
import { workOrders } from "../work-orders";

// Central equipment registry - uses shared column builders to reduce duplication
export const equipment = pgTable(
  "equipment",
  {
    ...uuidPrimaryKey(),
    ...tenantColumn(organizations),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    vesselName: text("vessel_name"),
    name: text("name").notNull(),
    type: text("type").notNull(),
    // NOTE: phantom `category` and `equipment_type` columns dropped — canonical
    // Postgres uses `type`, `systemType`, and `componentType` for categorization.
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    location: text("location"),
    isActive: boolean("is_active").default(true),
    specifications: jsonb("specifications"),
    operatingParameters: jsonb("operating_parameters"),
    maintenanceSchedule: jsonb("maintenance_schedule"),
    emergencyLaborMultiplier: numeric("emergency_labor_multiplier", {
      precision: 6,
      scale: 3,
      mode: "number",
    }),
    emergencyPartsMultiplier: numeric("emergency_parts_multiplier", {
      precision: 6,
      scale: 3,
      mode: "number",
    }),
    emergencyDowntimeMultiplier: numeric("emergency_downtime_multiplier", {
      precision: 6,
      scale: 3,
      mode: "number",
    }),
    downtimeCostPerHour: numeric("downtime_cost_per_hour", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    plainLanguageName: varchar("plain_language_name"),
    systemType: varchar("system_type"),
    componentType: varchar("component_type"),
    criticalityLevel: varchar("criticality_level").default("medium"),
    defaultServiceProviderId: varchar("default_service_provider_id").references(() => suppliers.id),
    purchaseValue: numeric("purchase_value", { precision: 12, scale: 2, mode: "number" }),
    purchaseDate: timestamp("purchase_date", { mode: "date" }),
    purchaseCurrency: varchar("purchase_currency").default("USD"),
    serviceLifeHours: real("service_life_hours"),
    serviceLifeYears: real("service_life_years"),
    depreciationMethod: varchar("depreciation_method").default("straight_line"),
    depreciationRate: real("depreciation_rate"),
    salvageValue: numeric("salvage_value", { precision: 12, scale: 2, mode: "number" }),
    decommissionedAt: timestamp("decommissioned_at", { mode: "date" }),
    decommissionedBy: varchar("decommissioned_by"),
    decommissionStatus: varchar("decommission_status").default("active"),
    decommissionEventId: varchar("decommission_event_id"),
    reinstatedAt: timestamp("reinstated_at", { mode: "date" }),
    reinstatedBy: varchar("reinstated_by"),
    parentEquipmentId: varchar("parent_equipment_id").references((): AnyPgColumn => equipment.id, {
      onDelete: "set null",
    }),
    hierarchyLevel: integer("hierarchy_level").default(0),
    hierarchyPath: text("hierarchy_path").default(""),
    ...timestamps(),
    ...versionTracking(),
  },
  (table) => ({
    uniqueEquipmentPerVessel: unique("unique_equipment_per_vessel").on(table.vesselId, table.name),
  })
);

// Edge devices
export const devices = pgTable("devices", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  label: text("label"),
  vessel: text("vessel"),
  buses: jsonb("buses"),
  sensors: jsonb("sensors"),
  config: jsonb("config"),
  hmacKey: text("hmac_key"),
  deviceType: text("device_type").default("generic"),
  j1939Config: jsonb("j1939_config"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Edge device heartbeats
export const edgeHeartbeats = pgTable(
  "edge_heartbeats",
  {
    deviceId: varchar("device_id")
      .primaryKey()
      .references(() => devices.id),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    ts: timestamp("ts", { mode: "date" }).defaultNow(),
    cpuPct: real("cpu_pct"),
    memPct: real("mem_pct"),
    diskFreeGb: real("disk_free_gb"),
    bufferRows: integer("buffer_rows"),
    swVersion: text("sw_version"),
  },
  (table) => ({
    orgIdIdx: index("idx_edge_heartbeats_org_id").on(table.orgId),
    orgDeviceIdx: index("idx_edge_heartbeats_org_device").on(table.orgId, table.deviceId),
  })
);

// PdM score logs
export const pdmScoreLogs = pgTable("pdm_score_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  ts: timestamp("ts", { mode: "date" }).defaultNow(),
  equipmentId: varchar("equipment_id")
    .notNull()
    .references(() => equipment.id),
  healthIdx: real("health_idx"),
  pFail30d: real("p_fail_30d"),
  predictedDueDate: timestamp("predicted_due_date", { mode: "date" }),
  contextJson: jsonb("context_json"),
});

// Equipment lifecycle tracking — aligned with deployed PG (rich lifecycle record)
export const equipmentLifecycle = pgTable(
  "equipment_lifecycle",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    installationDate: timestamp("installation_date", { mode: "date" }),
    warrantyExpiry: timestamp("warranty_expiry", { mode: "date" }),
    expectedLifespan: integer("expected_lifespan"),
    replacementCost: numeric("replacement_cost", { precision: 12, scale: 2, mode: "number" }),
    operatingHours: integer("operating_hours").default(0),
    maintenanceCount: integer("maintenance_count").default(0),
    lastMajorOverhaul: timestamp("last_major_overhaul", { mode: "date" }),
    nextRecommendedReplacement: timestamp("next_recommended_replacement", { mode: "date" }),
    condition: text("condition").notNull().default("good"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdx: index("idx_equipment_lifecycle_org_id").on(table.orgId),
  })
);

// Performance metrics — aligned with deployed PG (specific-metric columns)
export const performanceMetrics = pgTable(
  "performance_metrics",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id").notNull(),
    metricDate: timestamp("metric_date", { mode: "date" }).notNull(),
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
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentMetricDateIdx: index("idx_perf_equipment_date").on(
      table.equipmentId,
      table.metricDate
    ),
  })
);

// Equipment decommission events
export const equipmentDecommissionEvents = pgTable(
  "equipment_decommission_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    reason: varchar("reason").notNull(),
    eventDate: timestamp("event_date", { mode: "date" }).notNull(),
    authorizedBy: varchar("authorized_by"),
    finalCondition: varchar("final_condition"),
    notes: text("notes"),
    saleDetails: jsonb("sale_details"),
    disposalDetails: jsonb("disposal_details"),
    replacementEquipmentId: varchar("replacement_equipment_id").references(() => equipment.id),
    bookValueAtRemoval: numeric("book_value_at_removal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    residualValue: numeric("residual_value", { precision: 12, scale: 2, mode: "number" }),
    documentationRefs: jsonb("documentation_refs"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_decommission_equipment").on(table.equipmentId),
    reasonIdx: index("idx_decommission_reason").on(table.reason),
    orgDateIdx: index("idx_decommission_org_date").on(table.orgId, table.eventDate),
  })
);
