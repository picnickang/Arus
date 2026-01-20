/**
 * SQLite Schema Sensors Module
 * Sensor configurations, states, types, thresholds, calibration
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const sensorConfigurationsSqlite = sqliteTable(
  "sensor_configurations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    name: text("name"),
    unit: text("unit"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    warningThreshold: real("warning_threshold"),
    criticalThreshold: real("critical_threshold"),
    samplingIntervalMs: integer("sampling_interval_ms"),
    calibrationDate: integer("calibration_date", { mode: "timestamp" }),
    calibrationDueDate: integer("calibration_due_date", { mode: "timestamp" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_sc_equipment").on(table.equipmentId),
    sensorTypeIdx: index("idx_sc_sensor_type").on(table.sensorType),
  })
);

export const sensorStatesSqlite = sqliteTable(
  "sensor_states",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    currentValue: real("current_value"),
    status: text("status").notNull().default("normal"),
    lastReading: integer("last_reading", { mode: "timestamp" }),
    readingsCount: integer("readings_count").default(0),
    avgValue: real("avg_value"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentSensorIdx: index("idx_ss_equipment_sensor").on(table.equipmentId, table.sensorType),
  })
);

export const sensorTypesSqlite = sqliteTable(
  "sensor_types",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    category: text("category"),
    defaultUnit: text("default_unit"),
    description: text("description"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    codeIdx: index("idx_stypes_code").on(table.code),
  })
);

export const thresholdOptimizationsSqlite = sqliteTable(
  "threshold_optimizations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    currentThreshold: real("current_threshold"),
    suggestedThreshold: real("suggested_threshold"),
    confidenceScore: real("confidence_score"),
    optimizationReason: text("optimization_reason"),
    status: text("status").notNull().default("pending"),
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    appliedBy: text("applied_by"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_to_equipment").on(table.equipmentId),
    statusIdx: index("idx_to_status").on(table.status),
  })
);

export const calibrationCacheSqlite = sqliteTable(
  "calibration_cache",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    calibrationData: text("calibration_data"),
    validFrom: integer("valid_from", { mode: "timestamp" }),
    validTo: integer("valid_to", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentSensorIdx: index("idx_cc_equipment_sensor").on(table.equipmentId, table.sensorType),
  })
);

export const sensorMappingSqlite = sqliteTable(
  "sensor_mappings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sourceSensorId: text("source_sensor_id"),
    targetSensorType: text("target_sensor_type").notNull(),
    mappingType: text("mapping_type").notNull(),
    transformFormula: text("transform_formula"),
    scaleFactor: real("scale_factor").default(1),
    offset: real("offset").default(0),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_sm_equipment").on(table.equipmentId),
  })
);

export const sensorThresholdsSqlite = sqliteTable(
  "sensor_thresholds",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id"),
    sensorType: text("sensor_type").notNull(),
    thresholdType: text("threshold_type").notNull(),
    lowerWarning: real("lower_warning"),
    upperWarning: real("upper_warning"),
    lowerCritical: real("lower_critical"),
    upperCritical: real("upper_critical"),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    sensorTypeIdx: index("idx_sth_sensor_type").on(table.sensorType),
    equipmentIdx: index("idx_sth_equipment").on(table.equipmentId),
  })
);

export const operatingParametersSqlite = sqliteTable(
  "operating_parameters",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    parameterName: text("parameter_name").notNull(),
    normalValue: real("normal_value"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    unit: text("unit"),
    tolerance: real("tolerance"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_op_equipment").on(table.equipmentId),
  })
);

export const discoveredSignalsSqlite = sqliteTable(
  "discovered_signals",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    signalName: text("signal_name").notNull(),
    signalType: text("signal_type"),
    sourceProtocol: text("source_protocol"),
    discoveredAt: integer("discovered_at", { mode: "timestamp" }),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    sampleCount: integer("sample_count").default(0),
    metadata: text("metadata"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentIdx: index("idx_ds_equipment").on(table.equipmentId),
  })
);

export const j1939ConfigurationsSqlite = sqliteTable("j1939_configurations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  equipmentId: text("equipment_id").notNull(),
  pgn: integer("pgn").notNull(),
  spn: integer("spn"),
  name: text("name"),
  description: text("description"),
  scaleFactor: real("scale_factor"),
  offset: real("offset"),
  unit: text("unit"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }),
});
