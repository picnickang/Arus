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
    manufacturer: text("manufacturer"),
    model: text("model"),
    serialNumber: text("serial_number"),
    location: text("location"),
    isActive: boolean("is_active").default(true),
    specifications: jsonb("specifications"),
    operatingParameters: jsonb("operating_parameters"),
    maintenanceSchedule: jsonb("maintenance_schedule"),
    emergencyLaborMultiplier: real("emergency_labor_multiplier"),
    emergencyPartsMultiplier: real("emergency_parts_multiplier"),
    emergencyDowntimeMultiplier: real("emergency_downtime_multiplier"),
    downtimeCostPerHour: real("downtime_cost_per_hour"),
    plainLanguageName: varchar("plain_language_name"),
    systemType: varchar("system_type"),
    componentType: varchar("component_type"),
    criticalityLevel: varchar("criticality_level").default("medium"),
    defaultServiceProviderId: varchar("default_service_provider_id").references(() => suppliers.id),
    purchaseValue: real("purchase_value"),
    purchaseDate: timestamp("purchase_date", { mode: "date" }),
    purchaseCurrency: varchar("purchase_currency").default("USD"),
    serviceLifeHours: real("service_life_hours"),
    serviceLifeYears: real("service_life_years"),
    depreciationMethod: varchar("depreciation_method").default("straight_line"),
    depreciationRate: real("depreciation_rate"),
    salvageValue: real("salvage_value"),
    decommissionedAt: timestamp("decommissioned_at", { mode: "date" }),
    decommissionedBy: varchar("decommissioned_by"),
    decommissionStatus: varchar("decommission_status").default("active"),
    decommissionEventId: varchar("decommission_event_id"),
    reinstatedAt: timestamp("reinstated_at", { mode: "date" }),
    reinstatedBy: varchar("reinstated_by"),
    parentEquipmentId: varchar("parent_equipment_id").references((): any => equipment.id, { onDelete: "set null" }),
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

// Equipment lifecycle tracking
export const equipmentLifecycle = pgTable(
  "equipment_lifecycle",
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
    eventType: text("event_type").notNull(),
    eventDate: timestamp("event_date", { mode: "date" }).notNull(),
    description: text("description"),
    cost: real("cost"),
    performedBy: text("performed_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_lifecycle_equipment").on(table.equipmentId),
    eventTypeIdx: index("idx_lifecycle_event_type").on(table.eventType),
  })
);

// Performance metrics
export const performanceMetrics = pgTable(
  "performance_metrics",
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
    metricType: text("metric_type").notNull(),
    value: real("value").notNull(),
    unit: text("unit"),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentMetricIdx: index("idx_perf_equipment_metric").on(table.equipmentId, table.metricType),
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
    bookValueAtRemoval: real("book_value_at_removal"),
    residualValue: real("residual_value"),
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
    reason: text("reason").notNull(),
    category: text("category"),
    severity: text("severity").default("medium"),
    workOrderId: varchar("work_order_id").references(() => workOrders.id),
    estimatedCost: real("estimated_cost"),
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
    failureMode: text("failure_mode").notNull(),
    rootCause: text("root_cause"),
    operatingHours: real("operating_hours"),
    environment: jsonb("environment"),
    correctiveAction: text("corrective_action"),
    replacementPartId: varchar("replacement_part_id"),
    costImpact: real("cost_impact"),
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
export const industryBenchmarks = pgTable(
  "industry_benchmarks",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentType: text("equipment_type").notNull(),
    metric: text("metric").notNull(),
    benchmarkValue: real("benchmark_value").notNull(),
    unit: text("unit"),
    source: text("source"),
    effectiveDate: timestamp("effective_date", { mode: "date" }),
    expirationDate: timestamp("expiration_date", { mode: "date" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentTypeIdx: index("idx_industry_benchmarks_equipment").on(table.equipmentType),
    metricIdx: index("idx_industry_benchmarks_metric").on(table.metric),
  })
);

// Operating parameters
export const operatingParameters = pgTable(
  "operating_parameters",
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
    parameterName: text("parameter_name").notNull(),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    optimalValue: real("optimal_value"),
    unit: text("unit"),
    category: text("category"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_operating_parameters_equipment").on(table.equipmentId),
    parameterIdx: index("idx_operating_parameters_name").on(table.parameterName),
  })
);

// Operating condition alerts
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
    parameterId: varchar("parameter_id").references(() => operatingParameters.id),
    alertType: text("alert_type").notNull(),
    severity: text("severity").default("warning"),
    currentValue: real("current_value"),
    thresholdValue: real("threshold_value"),
    message: text("message"),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    acknowledgedBy: varchar("acknowledged_by"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    alertedAt: timestamp("alerted_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_operating_condition_alerts_equipment").on(table.equipmentId),
    severityIdx: index("idx_operating_condition_alerts_severity").on(table.severity),
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

export const insertEquipmentLifecycleSchema = createInsertSchema(equipmentLifecycle)
  .omit({ id: true, createdAt: true })
  .extend({
    eventType: z.enum(["installation", "upgrade", "repair", "replacement", "decommission"]),
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
export const insertDowntimeEventSchema = createInsertSchema(downtimeEvents)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertPartFailureHistorySchema = createInsertSchema(partFailureHistory)
  .omit({ id: true, createdAt: true });

export const insertIndustryBenchmarkSchema = createInsertSchema(industryBenchmarks)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertOperatingParameterSchema = createInsertSchema(operatingParameters)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertOperatingConditionAlertSchema = createInsertSchema(operatingConditionAlerts)
  .omit({ id: true, alertedAt: true });

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
