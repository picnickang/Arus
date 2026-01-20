/**
 * Schema Sensors - Sensor Types, Mappings, Configurations, and Templates
 * 
 * Sensor management including types catalog, equipment mappings, and reusable templates.
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
  index,
  createInsertSchema,
  z,
} from "./base.js";
import { organizations } from "./core.js";
import { devices } from "./equipment.js";

// Sensor types catalog for standardization
export const sensorTypes = pgTable("sensor_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  defaultUnit: text("default_unit").notNull(),
  units: jsonb("units").notNull(),
  description: text("description"),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Sensor mapping for equipment-specific configurations
export const sensorMapping = pgTable("sensor_mapping", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  vesselId: text("vessel_id").notNull(),
  sourceId: text("source_id").notNull(),
  signalId: text("signal_id").notNull(),
  sensorTypeId: text("sensor_type_id")
    .notNull()
    .references(() => sensorTypes.id),
  equipmentId: text("equipment_id"),
  preferredUnit: text("preferred_unit"),
  scalingFactor: real("scaling_factor").default(1),
  offset: real("offset").default(0),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Auto-discovered signals from telemetry data
export const discoveredSignals = pgTable("discovered_signals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  vesselId: text("vessel_id").notNull(),
  sourceId: text("source_id").notNull(),
  signalId: text("signal_id").notNull(),
  unit: text("unit"),
  firstSeen: timestamp("first_seen", { mode: "date" }).defaultNow(),
  lastSeen: timestamp("last_seen", { mode: "date" }).defaultNow(),
  sampleCount: integer("sample_count").default(0),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  avgValue: real("avg_value"),
  isMapped: boolean("is_mapped").default(false),
  suggestedSensorType: text("suggested_sensor_type"),
});

// Sensor configurations per-sensor with scaling, validation, EMA
export const sensorConfigurations = pgTable(
  "sensor_configurations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    enabled: boolean("enabled").default(true),
    sampleRateHz: real("sample_rate_hz"),
    gain: real("gain").default(1),
    offset: real("offset").default(0),
    deadband: real("deadband").default(0),
    minValid: real("min_valid"),
    maxValid: real("max_valid"),
    warnLo: real("warn_lo"),
    warnHi: real("warn_hi"),
    critLo: real("crit_lo"),
    critHi: real("crit_hi"),
    hysteresis: real("hysteresis").default(0),
    emaAlpha: real("ema_alpha"),
    targetUnit: text("target_unit"),
    notes: text("notes"),
    expectedIntervalMs: integer("expected_interval_ms"),
    graceMultiplier: real("grace_multiplier").default(2),
    version: integer("version").default(1),
    lastModifiedBy: varchar("last_modified_by", { length: 255 }),
    lastModifiedDevice: varchar("last_modified_device", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueSensorConfig: sql`UNIQUE (equipment_id, sensor_type, org_id)`,
  })
);

// Sensor states for runtime tracking
export const sensorStates = pgTable(
  "sensor_states",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    lastValue: real("last_value"),
    ema: real("ema"),
    lastTs: timestamp("last_ts", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    uniqueSensorState: sql`UNIQUE (equipment_id, sensor_type, org_id)`,
  })
);

// Sensor templates - reusable sensor configurations
export const sensorTemplates = pgTable(
  "sensor_templates",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    unit: text("unit").notNull(),
    equipmentTypes: text("equipment_types").array(),
    fields: jsonb("fields").notNull().$type<Record<string, unknown>>(),
    notes: text("notes"),
    isSystemDefault: boolean("is_system_default").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    orgTemplateUnique: sql`UNIQUE NULLS NOT DISTINCT (org_id, template_id)`,
    orgTemplateIdx: index("sensor_templates_org_template_idx").on(table.orgId, table.templateId),
    kindIdx: index("sensor_templates_kind_idx").on(table.kind),
  })
);

// Sensor bundles - predefined groups of sensor templates for equipment types
export const sensorBundles = pgTable(
  "sensor_bundles",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    bundleId: text("bundle_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    equipmentType: text("equipment_type").notNull(),
    templateIds: text("template_ids").array().notNull(),
    isSystemDefault: boolean("is_system_default").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    orgBundleUnique: sql`UNIQUE NULLS NOT DISTINCT (org_id, bundle_id)`,
    orgBundleIdx: index("sensor_bundles_org_bundle_idx").on(table.orgId, table.bundleId),
    equipmentTypeIdx: index("sensor_bundles_equipment_type_idx").on(table.equipmentType),
  })
);

// Sensor threshold rules
export const sensorThresholds = pgTable(
  "sensor_thresholds",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id")
      .notNull()
      .references(() => devices.id),
    sensorType: text("sensor_type").notNull(),
    rule: jsonb("rule").notNull(),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    warningThreshold: real("warning_threshold"),
    criticalThreshold: real("critical_threshold"),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    deviceIdx: sql`CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_device ON sensor_thresholds (device_id, sensor_type)`,
    activeIdx: sql`CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_active ON sensor_thresholds (is_active, device_id)`,
    orgDeviceSensorActiveIdx: sql`CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_org_device_sensor_active ON sensor_thresholds (org_id, device_id, sensor_type, is_active)`,
  })
);

// Insert schemas
export const insertSensorTypeSchema = createInsertSchema(sensorTypes);

export const insertSensorMappingSchema = createInsertSchema(sensorMapping).omit({
  id: true,
  updatedAt: true,
});

export const insertDiscoveredSignalSchema = createInsertSchema(discoveredSignals).omit({
  id: true,
  firstSeen: true,
  lastSeen: true,
});

export const insertSensorConfigSchema = createInsertSchema(sensorConfigurations).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSensorStateSchema = createInsertSchema(sensorStates).omit({
  id: true,
  orgId: true,
  updatedAt: true,
});

export const insertSensorTemplateSchema = createInsertSchema(sensorTemplates, {
  equipmentTypes: z.array(z.string()).optional().nullable(),
  fields: z.record(z.any()),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isSystemDefault: true,
  createdBy: true,
});

export const insertSensorBundleSchema = createInsertSchema(sensorBundles, {
  templateIds: z.array(z.string()).min(1, "Bundle must contain at least one template"),
  equipmentType: z.string().min(1, "Equipment type is required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isSystemDefault: true,
});

export const insertSensorThresholdSchema = createInsertSchema(sensorThresholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Bulk sensor creation schemas
export const bulkSensorConfigItemSchema = insertSensorConfigSchema.omit({
  equipmentId: true,
  version: true,
  lastModifiedBy: true,
  lastModifiedDevice: true,
});

export const bulkSensorConfigSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  bundleId: z.string().optional(),
  configs: z.array(bulkSensorConfigItemSchema).min(1, "At least one sensor configuration is required"),
  overwriteExisting: z.boolean().default(false),
});

// Types
export type SensorType = typeof sensorTypes.$inferSelect;
export type InsertSensorType = z.infer<typeof insertSensorTypeSchema>;

export type SensorMapping = typeof sensorMapping.$inferSelect;
export type InsertSensorMapping = z.infer<typeof insertSensorMappingSchema>;

export type DiscoveredSignal = typeof discoveredSignals.$inferSelect;
export type InsertDiscoveredSignal = z.infer<typeof insertDiscoveredSignalSchema>;

export type SensorConfiguration = typeof sensorConfigurations.$inferSelect;
export type InsertSensorConfiguration = z.infer<typeof insertSensorConfigSchema>;

export type SensorState = typeof sensorStates.$inferSelect;
export type InsertSensorState = z.infer<typeof insertSensorStateSchema>;

export type SensorTemplate = typeof sensorTemplates.$inferSelect;
export type InsertSensorTemplate = z.infer<typeof insertSensorTemplateSchema>;

export type SensorBundle = typeof sensorBundles.$inferSelect;
export type InsertSensorBundle = z.infer<typeof insertSensorBundleSchema>;

export type BulkSensorConfigItem = z.infer<typeof bulkSensorConfigItemSchema>;
export type BulkSensorConfigPayload = z.infer<typeof bulkSensorConfigSchema>;

export type SensorThreshold = typeof sensorThresholds.$inferSelect;
export type InsertSensorThreshold = z.infer<typeof insertSensorThresholdSchema>;
