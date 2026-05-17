/**
 * Schema IoT Edge - Device Management and Edge Diagnostics
 *
 * MQTT devices, device registry, transport settings, diagnostics,
 * failovers, serial port states, calibration, and data quality.
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
  serial,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { devices } from "./equipment";

// MQTT device management for sensor networks
export const mqttDevices = pgTable(
  "mqtt_devices",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id")
      .references(() => devices.id)
      .notNull(),
    mqttClientId: varchar("mqtt_client_id").unique().notNull(),
    brokerEndpoint: varchar("broker_endpoint").notNull(),
    topicPrefix: varchar("topic_prefix").notNull(),
    qosLevel: integer("qos_level").default(1),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    connectionStatus: varchar("connection_status").default("disconnected"),
    credentials: jsonb("credentials"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_mqtt_devices_org_id").on(table.orgId),
    orgDeviceIdx: index("idx_mqtt_devices_org_device").on(table.orgId, table.deviceId),
  })
);

// Device registry for Hub & Sync
export const deviceRegistry = pgTable(
  "device_registry",
  {
    id: text("id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    label: text("label"),
    deviceId: text("device_id"),
    lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({ orgIdIdx: index("idx_device_registry_org_id").on(table.orgId) })
);

// Transport settings for telemetry ingestion configuration
export const transportSettings = pgTable("transport_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  enableHttpIngest: boolean("enable_http_ingest").default(true),
  enableMqttIngest: boolean("enable_mqtt_ingest").default(false),
  mqttHost: text("mqtt_host"),
  mqttPort: integer("mqtt_port").default(8883),
  mqttUser: text("mqtt_user"),
  mqttPass: text("mqtt_pass"),
  mqttTopic: text("mqtt_topic").default("fleet/+/telemetry"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Edge Diagnostics: Diagnostic event log for auto-fix tracking
export const edgeDiagnosticLogs = pgTable(
  "edge_diagnostic_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id").references(() => devices.id),
    equipmentId: varchar("equipment_id"),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull().default("info"),
    status: text("status").notNull().default("pending"),
    message: text("message").notNull(),
    details: jsonb("details"),
    autoFixApplied: boolean("auto_fix_applied").default(false),
    autoFixAction: text("auto_fix_action"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
  },
  (table) => ({
    deviceIdx: index("idx_edge_diag_device").on(table.deviceId, table.createdAt),
    eventTypeIdx: index("idx_edge_diag_event_type").on(table.eventType),
    statusIdx: index("idx_edge_diag_status").on(table.status),
  })
);

// Edge Diagnostics: Transport failover tracking (MQTT→HTTP fallback)
export const transportFailovers = pgTable(
  "transport_failovers",
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
    fromTransport: text("from_transport").notNull(),
    toTransport: text("to_transport").notNull(),
    reason: text("reason").notNull(),
    failedAt: timestamp("failed_at", { mode: "date" }).defaultNow(),
    recoveredAt: timestamp("recovered_at", { mode: "date" }),
    readingsPending: integer("readings_pending").default(0),
    readingsFlushed: integer("readings_flushed").default(0),
    isActive: boolean("is_active").default(true),
  },
  (table) => ({
    deviceIdx: index("idx_failover_device").on(table.deviceId, table.failedAt),
    activeIdx: index("idx_failover_active").on(table.isActive),
  })
);

// Edge Diagnostics: Serial/CAN port state tracking
export const serialPortStates = pgTable(
  "serial_port_states",
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
    portPath: text("port_path").notNull(),
    portType: text("port_type").notNull(),
    protocol: text("protocol"),
    baudRate: integer("baud_rate"),
    parity: text("parity"),
    dataBits: integer("data_bits").default(8),
    stopBits: integer("stop_bits").default(1),
    status: text("status").notNull().default("unknown"),
    lastFrameAt: timestamp("last_frame_at", { mode: "date" }),
    frameCount: integer("frame_count").default(0),
    errorCount: integer("error_count").default(0),
    autoDetectedBaud: boolean("auto_detected_baud").default(false),
    autoDetectedProtocol: boolean("auto_detected_protocol").default(false),
    restartCount: integer("restart_count").default(0),
    lastRestartAt: timestamp("last_restart_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    devicePortIdx: index("idx_serial_port_device").on(table.deviceId, table.portPath),
    statusIdx: index("idx_serial_port_status").on(table.status),
  })
);

// Edge Diagnostics: Calibration coefficient cache
export const calibrationCache = pgTable(
  "calibration_cache",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    equipmentType: text("equipment_type").notNull(),
    manufacturer: text("manufacturer").notNull(),
    model: text("model").notNull(),
    sensorType: text("sensor_type").notNull(),
    calibrationSource: text("calibration_source").notNull(),
    coefficients: jsonb("coefficients").notNull(),
    validFrom: timestamp("valid_from", { mode: "date" }),
    validUntil: timestamp("valid_until", { mode: "date" }),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow(),
    appliedToConfigs: integer("applied_to_configs").default(0),
    notes: text("notes"),
  },
  (table) => ({
    equipmentIdx: index("idx_calibration_equipment").on(
      table.equipmentType,
      table.manufacturer,
      table.model
    ),
    sensorIdx: index("idx_calibration_sensor").on(table.sensorType),
  })
);

// ML probability calibration curves
export const calibrationCurves = pgTable(
  "calibration_curves",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id)
      .default("default-org-id"),
    modelType: varchar("model_type").notNull(),
    equipmentType: varchar("equipment_type").notNull(),
    method: varchar("method").notNull(),
    parameters: jsonb("parameters").notNull(),
    trainingSize: integer("training_size").notNull(),
    trainingDate: timestamp("training_date", { withTimezone: true }).notNull(),
    validationBrier: real("validation_brier"),
    validationEce: real("validation_ece"),
    status: varchar("status").default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    modelTypeIdx: index("idx_calibration_model_type").on(table.modelType, table.equipmentType),
    orgIdx: index("idx_calibration_org").on(table.orgId),
  })
);

// Real-time data quality validation results
export const dataQualityMetrics = pgTable("data_quality_metrics", {
  id: serial("id").primaryKey(),
  equipmentId: varchar("equipment_id").notNull(),
  sensorType: varchar("sensor_type").notNull(),
  validationTimestamp: timestamp("validation_timestamp", { withTimezone: true }).defaultNow(),
  completenessScore: real("completeness_score"),
  consistencyScore: real("consistency_score"),
  timelinessScore: real("timeliness_score"),
  accuracyScore: real("accuracy_score"),
  overallQuality: real("overall_quality"),
  issuesDetected: jsonb("issues_detected"),
  recommendedActions: jsonb("recommended_actions"),
  metadata: jsonb("metadata"),
});

// Insert schemas
export const insertMqttDeviceSchema = createInsertSchema(mqttDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDeviceRegistrySchema = createInsertSchema(deviceRegistry).omit({
  createdAt: true,
});
export const insertTransportSettingsSchema = createInsertSchema(transportSettings).omit({
  id: true,
  updatedAt: true,
});
export const insertEdgeDiagnosticLogSchema = createInsertSchema(edgeDiagnosticLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    eventType: z.enum([
      "mqtt_failover",
      "credential_refresh",
      "port_restart",
      "baud_detect",
      "pgn_conflict",
      "hot_plug",
      "clock_skew",
      "config_reconcile",
      "calibration_fetch",
    ]),
    severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
    status: z.enum(["pending", "in_progress", "success", "failed"]).default("pending"),
  });
export const insertTransportFailoverSchema = createInsertSchema(transportFailovers)
  .omit({ id: true, failedAt: true })
  .extend({
    fromTransport: z.enum(["mqtt", "http", "serial", "can"]),
    toTransport: z.enum(["mqtt", "http", "serial", "can"]),
  });
export const insertSerialPortStateSchema = createInsertSchema(serialPortStates).omit({
  id: true,
  updatedAt: true,
});
export const insertCalibrationCacheSchema = createInsertSchema(calibrationCache).omit({
  id: true,
  fetchedAt: true,
});
export const insertCalibrationCurveSchema = createInsertSchema(calibrationCurves).omit({
  id: true,
  createdAt: true,
});
export const insertDataQualityMetricSchema = createInsertSchema(dataQualityMetrics).omit({
  id: true,
  validationTimestamp: true,
});

// Types
export type MqttDevice = typeof mqttDevices.$inferSelect;
export type InsertMqttDevice = z.infer<typeof insertMqttDeviceSchema>;
export type DeviceRegistry = typeof deviceRegistry.$inferSelect;
export type InsertDeviceRegistry = z.infer<typeof insertDeviceRegistrySchema>;
export type TransportSettings = typeof transportSettings.$inferSelect;
export type InsertTransportSettings = z.infer<typeof insertTransportSettingsSchema>;
export type EdgeDiagnosticLog = typeof edgeDiagnosticLogs.$inferSelect;
export type InsertEdgeDiagnosticLog = z.infer<typeof insertEdgeDiagnosticLogSchema>;
export type TransportFailover = typeof transportFailovers.$inferSelect;
export type InsertTransportFailover = z.infer<typeof insertTransportFailoverSchema>;
export type SerialPortState = typeof serialPortStates.$inferSelect;
export type InsertSerialPortState = z.infer<typeof insertSerialPortStateSchema>;
export type CalibrationCache = typeof calibrationCache.$inferSelect;
export type InsertCalibrationCache = z.infer<typeof insertCalibrationCacheSchema>;
export type CalibrationCurve = typeof calibrationCurves.$inferSelect;
export type InsertCalibrationCurve = z.infer<typeof insertCalibrationCurveSchema>;
export type DataQualityMetric = typeof dataQualityMetrics.$inferSelect;
export type InsertDataQualityMetric = z.infer<typeof insertDataQualityMetricSchema>;
