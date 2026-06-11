/**
 * Schema Equipment - Equipment Registry, Devices, and Lifecycle
 *
 * Central equipment catalog, edge devices, and lifecycle tracking.
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
  createInsertSchema,
  z,
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
  versionTracking,
} from "./base";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations } from "./core";
import { vessels } from "./vessels";
import { suppliers, parts } from "./inventory";
import { workOrders } from "./work-orders";

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

// ========================================
// Equipment Analytics Tables
// ========================================

// Downtime events
export const downtimeEvents = pgTable(
  "downtime_events",
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
    startTime: timestamp("start_time", { mode: "date" }).notNull(),
    endTime: timestamp("end_time", { mode: "date" }),
    durationHours: real("duration_hours"),
    reason: text("reason"),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_downtime_events_equipment").on(table.equipmentId),
    orgIdx: index("idx_downtime_events_org").on(table.orgId),
    startTimeIdx: index("idx_downtime_events_start").on(table.startTime),
  })
);

// Part failure history
export const partFailureHistory = pgTable(
  "part_failure_history",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    partId: varchar("part_id")
      .notNull()
      .references(() => parts.id),
    equipmentId: varchar("equipment_id").references(() => equipment.id),
    failureDate: timestamp("failure_date", { mode: "date" }).notNull(),
    failureMode: text("failure_mode"),
    rootCause: text("root_cause"),
    operatingHours: real("operating_hours"),
    downtimeHours: real("downtime_hours"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    partIdx: index("idx_part_failure_history_part").on(table.partId),
    equipmentIdx: index("idx_part_failure_history_equipment").on(table.equipmentId),
    dateIdx: index("idx_part_failure_history_date").on(table.failureDate),
  })
);

// Industry benchmarks
// P2 #17 — tenant scoping: GLOBAL (intentional). No org_id column.
// Benchmarks represent industry-wide reference values for an
// equipment type and are shared read-only across all tenants. If a
// tenant ever needs to override benchmarks privately, add a new
// `tenant_benchmarks` table rather than back-filling org_id here.
export const industryBenchmarks = pgTable(
  "industry_benchmarks",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    equipmentType: text("equipment_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentTypeIdx: index("idx_industry_benchmarks_equipment").on(table.equipmentType),
  })
);

// Operating parameters — aligned with deployed PG (rich threshold model)
export const operatingParameters = pgTable(
  "operating_parameters",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentType: text("equipment_type").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    parameterName: text("parameter_name").notNull(),
    parameterType: text("parameter_type").notNull(),
    unit: text("unit").notNull(),
    optimalMin: real("optimal_min"),
    optimalMax: real("optimal_max"),
    criticalMin: real("critical_min"),
    criticalMax: real("critical_max"),
    lifeImpactDescription: text("life_impact_description"),
    recommendedAction: text("recommended_action"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
  },
  (table) => ({
    parameterIdx: index("idx_operating_params_param").on(table.parameterName),
    typeIdx: index("idx_operating_params_type").on(table.equipmentType),
  })
);

// Operating condition alerts — aligned with deployed PG + boolean flags & created_at
// (boolean flags backfilled from timestamp columns via migration)
export const operatingConditionAlerts = pgTable(
  "operating_condition_alerts",
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
    parameterId: varchar("parameter_id")
      .notNull()
      .references(() => operatingParameters.id),
    parameterName: text("parameter_name").notNull(),
    parameterType: text("parameter_type"),
    currentValue: real("current_value").notNull(),
    optimalMin: real("optimal_min"),
    optimalMax: real("optimal_max"),
    thresholdType: text("threshold_type").notNull(),
    severity: text("severity").notNull().default("warning"),
    lifeImpact: text("life_impact"),
    recommendedAction: text("recommended_action"),
    acknowledged: boolean("acknowledged").default(false),
    resolved: boolean("resolved").default(false),
    alertedAt: timestamp("alerted_at", { mode: "date" }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedBy: varchar("acknowledged_by"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_op_alerts_equipment").on(table.equipmentId),
    timeIdx: index("idx_op_alerts_time").on(table.alertedAt),
    activeIdx: index("idx_op_alerts_active").on(table.equipmentId, table.acknowledgedAt),
    resolvedIdx: index("idx_operating_condition_alerts_resolved").on(
      table.equipmentId,
      table.resolved
    ),
  })
);

// Insert schemas
export const insertEquipmentSchema = createInsertSchema(equipment)
  .omit({ id: true, createdAt: true, updatedAt: true, hierarchyLevel: true, hierarchyPath: true })
  .extend({
    vesselId: z.string().uuid().optional(),
    vesselName: z.string().optional(),
  });

export const insertDeviceSchema = createInsertSchema(devices).omit({ updatedAt: true });
export const insertHeartbeatSchema = createInsertSchema(edgeHeartbeats).omit({ ts: true });
export const insertPdmScoreSchema = createInsertSchema(pdmScoreLogs).omit({ id: true, ts: true });

export const insertEquipmentLifecycleSchema = createInsertSchema(equipmentLifecycle).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics)
  .omit({ id: true, createdAt: true })
  .extend({
    metricType: z.enum(["efficiency", "reliability", "availability", "mtbf", "mttr"]),
  });

export const decommissionReasonEnum = z.enum([
  "sold",
  "scrapped",
  "replaced",
  "end_of_life",
  "transferred",
  "damaged_beyond_repair",
]);

export const decommissionStatusEnum = z.enum([
  "active",
  "pending_decommission",
  "decommissioned",
  "disposed",
  "sold",
]);

export const saleDetailsSchema = z.object({
  salePrice: z.number().optional(),
  currency: z.string().optional(),
  buyerName: z.string().optional(),
  buyerContact: z.string().optional(),
  saleDate: z.string().optional(),
  invoiceRef: z.string().optional(),
});

export const disposalDetailsSchema = z.object({
  method: z.string().optional(),
  vendor: z.string().optional(),
  cost: z.number().optional(),
  environmentalNotes: z.string().optional(),
  certificationRef: z.string().optional(),
});

export const insertDecommissionEventSchema = createInsertSchema(equipmentDecommissionEvents)
  .omit({ id: true, createdAt: true })
  .extend({
    reason: decommissionReasonEnum,
    saleDetails: saleDetailsSchema.optional(),
    disposalDetails: disposalDetailsSchema.optional(),
    documentationRefs: z.array(z.string()).optional(),
  });

// Equipment analytics insert schemas
export const insertDowntimeEventSchema = createInsertSchema(downtimeEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartFailureHistorySchema = createInsertSchema(partFailureHistory).omit({
  id: true,
  createdAt: true,
});

export const insertIndustryBenchmarkSchema = createInsertSchema(industryBenchmarks).omit({
  id: true,
  createdAt: true,
});

export const insertOperatingParameterSchema = createInsertSchema(operatingParameters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperatingConditionAlertSchema = createInsertSchema(
  operatingConditionAlerts
).omit({ id: true, alertedAt: true });

// Types
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type EdgeHeartbeat = typeof edgeHeartbeats.$inferSelect;
export type InsertEdgeHeartbeat = z.infer<typeof insertHeartbeatSchema>;
export type PdmScoreLog = typeof pdmScoreLogs.$inferSelect;
export type InsertPdmScoreLog = z.infer<typeof insertPdmScoreSchema>;
export type EquipmentLifecycle = typeof equipmentLifecycle.$inferSelect;
export type InsertEquipmentLifecycle = z.infer<typeof insertEquipmentLifecycleSchema>;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;
export type EquipmentDecommissionEvent = typeof equipmentDecommissionEvents.$inferSelect;
export type InsertDecommissionEvent = z.infer<typeof insertDecommissionEventSchema>;
export type DecommissionReason = z.infer<typeof decommissionReasonEnum>;
export type DecommissionStatus = z.infer<typeof decommissionStatusEnum>;
export type SaleDetails = z.infer<typeof saleDetailsSchema>;
export type DisposalDetails = z.infer<typeof disposalDetailsSchema>;

// Equipment analytics types
export type DowntimeEvent = typeof downtimeEvents.$inferSelect;
export type InsertDowntimeEvent = z.infer<typeof insertDowntimeEventSchema>;
export type PartFailureHistory = typeof partFailureHistory.$inferSelect;
export type InsertPartFailureHistory = z.infer<typeof insertPartFailureHistorySchema>;
export type IndustryBenchmark = typeof industryBenchmarks.$inferSelect;
export type InsertIndustryBenchmark = z.infer<typeof insertIndustryBenchmarkSchema>;
export type OperatingParameter = typeof operatingParameters.$inferSelect;
export type InsertOperatingParameter = z.infer<typeof insertOperatingParameterSchema>;
export type OperatingConditionAlert = typeof operatingConditionAlerts.$inferSelect;
export type InsertOperatingConditionAlert = z.infer<typeof insertOperatingConditionAlertSchema>;
