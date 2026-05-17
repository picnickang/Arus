/**
 * Schema Telemetry - Telemetry Data, Retention, and Rollups
 *
 * Equipment telemetry, raw telemetry imports, retention policies, and aggregates.
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
import { equipment, devices } from "./equipment";
import { vessels } from "./vessels";

// Equipment telemetry data - TimescaleDB hypertable with composite primary key
export const equipmentTelemetry = pgTable(
  "equipment_telemetry",
  {
    id: varchar("id")
      .notNull()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    ts: timestamp("ts", { mode: "date" }).notNull().defaultNow(),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    sensorType: text("sensor_type").notNull(),
    value: real("value").notNull(),
    unit: text("unit"),
    threshold: real("threshold"),
    status: text("status").notNull().default("normal"),
    idempotencyKey: varchar("idempotency_key"),
    // NOTE: phantom `timestamp` (use `ts`) and `readings` (jsonb) columns
    // dropped — canonical Postgres stores one row per (equipment_id,
    // sensor_type, value) measurement, not a jsonb blob.
  },
  (table) => ({
    pk: sql`PRIMARY KEY (org_id, ts, id)`,
    equipmentTsIdx: sql`CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_equipment_ts ON equipment_telemetry (equipment_id, ts DESC)`,
    sensorTsIdx: sql`CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_sensor_ts ON equipment_telemetry (sensor_type, ts DESC)`,
    statusTsIdx: sql`CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_status_ts ON equipment_telemetry (status, ts DESC)`,
    idIdx: sql`CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_id ON equipment_telemetry (id)`,
    idempotencyIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_telemetry_idempotency ON equipment_telemetry (idempotency_key) WHERE idempotency_key IS NOT NULL`,
  })
);

// Telemetry dead letter queue for failed ingestion
export const telemetryDeadLetter = pgTable(
  "telemetry_dead_letter",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    queueName: varchar("queue_name").notNull(),
    payload: jsonb("payload").notNull(),
    error: text("error").notNull(),
    source: varchar("source").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    lastRetryAt: timestamp("last_retry_at", { mode: "date" }),
  },
  (table) => ({
    queueIdx: index("idx_telemetry_dlq_queue").on(table.queueName),
    sourceIdx: index("idx_telemetry_dlq_source").on(table.source),
    createdAtIdx: index("idx_telemetry_dlq_created").on(table.createdAt),
  })
);

// Raw telemetry ingestion table for manual CSV/JSON imports
export const rawTelemetry = pgTable(
  "raw_telemetry",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vessel: text("vessel").notNull(),
    ts: timestamp("ts", { mode: "date" }).notNull(),
    src: text("src").notNull(),
    sig: text("sig").notNull(),
    value: real("value"),
    unit: text("unit"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    orgIdIdx: index("idx_raw_telemetry_org_id").on(table.orgId),
    orgVesselIdx: index("idx_raw_telemetry_org_vessel").on(table.orgId, table.vessel),
    orgTsIdx: index("idx_raw_telemetry_org_ts").on(table.orgId, table.ts),
  })
);

// Retention policies for telemetry data
export const telemetryRetentionPolicies = pgTable("telemetry_retention_policies", {
  id: integer("id").primaryKey().default(1),
  retentionDays: integer("retention_days").default(365),
  rollupEnabled: boolean("rollup_enabled").default(true),
  rollupBucket: text("rollup_bucket").default("5 minutes"),
  compressionEnabled: boolean("compression_enabled").default(false),
  compressionAfterDays: integer("compression_after_days").default(7),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// TimescaleDB rollup data for telemetry
export const telemetryRollups = pgTable("telemetry_rollups", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => organizations.id),
  equipmentId: text("equipment_id").notNull(),
  sensorType: text("sensor_type").notNull(),
  bucket: timestamp("bucket", { mode: "date" }).notNull(),
  bucketSize: text("bucket_size").notNull(),
  avgValue: real("avg_value"),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  sampleCount: integer("sample_count").notNull(),
  unit: text("unit"),
});

// Time-series aggregated telemetry for analytics
export const telemetryAggregates = pgTable(
  "telemetry_aggregates",
  {
    id: serial("id").primaryKey(),
    orgId: varchar("org_id").notNull().default("default-org-id"),
    equipmentId: varchar("equipment_id").notNull(),
    sensorType: varchar("sensor_type").notNull(),
    timeWindow: varchar("time_window").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    avgValue: real("avg_value"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    stdDev: real("std_dev"),
    sampleCount: integer("sample_count"),
    anomalyScore: real("anomaly_score"),
    qualityScore: real("quality_score"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    equipmentTimeIdx: index("idx_telemetry_agg_equipment_time").on(
      table.equipmentId,
      table.windowStart
    ),
    orgTimeIdx: index("idx_telemetry_agg_org_time").on(table.orgId, table.windowStart),
  })
);

// J1939 configurations for CAN bus telemetry
export const j1939Configurations = pgTable(
  "j1939_configurations",
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
    canBusId: integer("can_bus_id").default(0),
    baudRate: integer("baud_rate").default(250000),
    sourceAddress: integer("source_address"),
    targetAddress: integer("target_address"),
    pgns: jsonb("pgns").$type<number[]>(),
    filterMode: text("filter_mode").default("whitelist"),
    enabled: boolean("enabled").default(true),
    pollIntervalMs: integer("poll_interval_ms").default(1000),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    deviceIdx: index("idx_j1939_config_device").on(table.deviceId),
    orgIdx: index("idx_j1939_config_org").on(table.orgId),
  })
);

// Daily metric rollups for analytics
export const dailyMetricRollups = pgTable(
  "daily_metric_rollups",
  {
    date: text("date").notNull(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    vesselId: varchar("vessel_id").references(() => vessels.id),
    deviceId: varchar("device_id").references(() => devices.id),
    metricName: text("metric_name").notNull(),
    value: real("value").notNull(),
    unit: text("unit"),
    aggregationType: text("aggregation_type").default("sum"),
    dataQuality: real("data_quality").default(1),
    calculatedAt: timestamp("calculated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    pk: sql`PRIMARY KEY (${table.date}, ${table.orgId}, ${table.vesselId}, ${table.deviceId}, ${table.metricName})`,
    vesselMetricIdx: sql`CREATE INDEX IF NOT EXISTS idx_daily_rollups_vessel_metric ON daily_metric_rollups (vessel_id, metric_name, date)`,
  })
);

// Engineer overrides for predictions — aligned with deployed PG (PdM-specific workflow)
export const engineerOverrides = pgTable(
  "engineer_overrides",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    predictionId: varchar("prediction_id"),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    workOrderId: varchar("work_order_id"),
    originalPrediction: jsonb("original_prediction").notNull(),
    originalRiskLevel: text("original_risk_level").notNull(),
    originalConfidence: real("original_confidence"),
    overrideType: text("override_type").notNull(),
    newRiskLevel: text("new_risk_level"),
    newScheduleDate: timestamp("new_schedule_date", { mode: "date" }),
    justification: text("justification").notNull(),
    engineerId: varchar("engineer_id").notNull(),
    engineerName: text("engineer_name").notNull(),
    engineerCertifications: text("engineer_certifications").array(),
    outcomeStatus: text("outcome_status").default("pending"),
    outcomeNotes: text("outcome_notes"),
    outcomeRecordedAt: timestamp("outcome_recorded_at", { mode: "date" }),
    outcomeRecordedBy: varchar("outcome_recorded_by"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    equipmentIdx: index("idx_engineer_overrides_equipment").on(table.equipmentId),
    engineerIdx: index("idx_engineer_overrides_engineer").on(table.engineerId),
    outcomeIdx: index("idx_engineer_overrides_outcome").on(table.outcomeStatus),
    createdAtIdx: index("idx_engineer_overrides_created_at").on(table.createdAt),
  })
);

// Insert schemas
export const insertEquipmentTelemetrySchema = createInsertSchema(equipmentTelemetry).omit({
  id: true,
});

export const insertRawTelemetrySchema = createInsertSchema(rawTelemetry).omit({
  id: true,
  createdAt: true,
});

export const insertTelemetryRetentionPolicySchema = createInsertSchema(telemetryRetentionPolicies);

export const insertTelemetryRollupSchema = createInsertSchema(telemetryRollups).omit({
  id: true,
});

export const insertTelemetryAggregateSchema = createInsertSchema(telemetryAggregates).omit({
  id: true,
  createdAt: true,
});

// Types
export type EquipmentTelemetry = typeof equipmentTelemetry.$inferSelect;
export type InsertEquipmentTelemetry = z.infer<typeof insertEquipmentTelemetrySchema>;

export type RawTelemetry = typeof rawTelemetry.$inferSelect;
export type InsertRawTelemetry = z.infer<typeof insertRawTelemetrySchema>;

export type TelemetryRetentionPolicy = typeof telemetryRetentionPolicies.$inferSelect;
export type InsertTelemetryRetentionPolicy = z.infer<typeof insertTelemetryRetentionPolicySchema>;

export type TelemetryRollup = typeof telemetryRollups.$inferSelect;
export type InsertTelemetryRollup = z.infer<typeof insertTelemetryRollupSchema>;

export type TelemetryAggregate = typeof telemetryAggregates.$inferSelect;
export type InsertTelemetryAggregate = z.infer<typeof insertTelemetryAggregateSchema>;

export const insertJ1939ConfigurationSchema = createInsertSchema(j1939Configurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyMetricRollupSchema = createInsertSchema(dailyMetricRollups).omit({
  calculatedAt: true,
});

export const insertEngineerOverrideSchema = createInsertSchema(engineerOverrides).omit({
  id: true,
  createdAt: true,
});

export type J1939Configuration = typeof j1939Configurations.$inferSelect;
export type InsertJ1939Configuration = z.infer<typeof insertJ1939ConfigurationSchema>;

export type DailyMetricRollup = typeof dailyMetricRollups.$inferSelect;
export type InsertDailyMetricRollup = z.infer<typeof insertDailyMetricRollupSchema>;

export type EngineerOverride = typeof engineerOverrides.$inferSelect;
export type InsertEngineerOverride = z.infer<typeof insertEngineerOverrideSchema>;

export const insertTelemetryDeadLetterSchema = createInsertSchema(telemetryDeadLetter).omit({
  id: true,
  createdAt: true,
});

export type TelemetryDeadLetter = typeof telemetryDeadLetter.$inferSelect;
export type InsertTelemetryDeadLetter = z.infer<typeof insertTelemetryDeadLetterSchema>;

// Raw telemetry archive - immutable storage before decoding
export const rawTelemetryArchive = pgTable(
  "raw_telemetry_archive",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id"),
    equipmentId: varchar("equipment_id"),
    source: varchar("source").notNull(),
    protocol: varchar("protocol").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    rawPayload: text("raw_payload").notNull(),
    payloadHash: varchar("payload_hash").notNull(),
    frameCount: integer("frame_count").notNull().default(1),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
    decodedAt: timestamp("decoded_at", { mode: "date" }),
    decodeStatus: varchar("decode_status").notNull().default("pending"),
    decodeError: text("decode_error"),
    readingsGenerated: integer("readings_generated").default(0),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    orgReceivedIdx: index("idx_raw_archive_org_received").on(table.orgId, table.receivedAt),
    deviceReceivedIdx: index("idx_raw_archive_device_received").on(
      table.deviceId,
      table.receivedAt
    ),
    statusIdx: index("idx_raw_archive_status").on(table.decodeStatus),
    payloadHashIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_archive_payload_hash ON raw_telemetry_archive (payload_hash) WHERE decode_status = 'pending'`,
  })
);

// Equipment heartbeat - last-seen tracking for freshness monitoring
export const equipmentHeartbeat = pgTable(
  "equipment_heartbeat",
  {
    equipmentId: varchar("equipment_id")
      .primaryKey()
      .references(() => equipment.id),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).notNull().defaultNow(),
    lastSignalType: varchar("last_signal_type"),
    lastValue: real("last_value"),
    onlineStatus: varchar("online_status").notNull().default("unknown"),
    signalCount24h: integer("signal_count_24h").default(0),
    avgLatencyMs: real("avg_latency_ms"),
    lastProtocol: varchar("last_protocol"),
    lastSource: varchar("last_source"),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    orgStatusIdx: index("idx_heartbeat_org_status").on(table.orgId, table.onlineStatus),
    lastSeenIdx: index("idx_heartbeat_last_seen").on(table.lastSeenAt),
  })
);

// Telemetry batch acknowledgment - edge buffering and store-and-forward
export const telemetryBatchAck = pgTable(
  "telemetry_batch_ack",
  {
    batchId: varchar("batch_id").primaryKey(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    deviceId: varchar("device_id"),
    source: varchar("source").notNull(),
    frameCount: integer("frame_count").notNull(),
    firstFrameTs: timestamp("first_frame_ts", { mode: "date" }).notNull(),
    lastFrameTs: timestamp("last_frame_ts", { mode: "date" }).notNull(),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { mode: "date" }),
    status: varchar("status").notNull().default("received"),
    readingsDecoded: integer("readings_decoded").default(0),
    readingsPersisted: integer("readings_persisted").default(0),
    errorCount: integer("error_count").default(0),
    processingTimeMs: integer("processing_time_ms"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    orgReceivedIdx: index("idx_batch_ack_org_received").on(table.orgId, table.receivedAt),
    deviceReceivedIdx: index("idx_batch_ack_device_received").on(table.deviceId, table.receivedAt),
    statusIdx: index("idx_batch_ack_status").on(table.status),
  })
);

// Telemetry schema registry - payload version metadata
export const telemetrySchemaRegistry = pgTable(
  "telemetry_schema_registry",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    protocol: varchar("protocol").notNull(),
    version: integer("version").notNull(),
    schemaName: varchar("schema_name").notNull(),
    description: text("description"),
    schemaDefinition: jsonb("schema_definition").notNull(),
    validationRules: jsonb("validation_rules"),
    decoderConfig: jsonb("decoder_config"),
    isActive: boolean("is_active").notNull().default(true),
    deprecatedAt: timestamp("deprecated_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    createdBy: varchar("created_by"),
  },
  (table) => ({
    protocolVersionIdx: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_registry_protocol_version ON telemetry_schema_registry (protocol, version)`,
    activeIdx: index("idx_schema_registry_active").on(table.isActive),
  })
);

// Insert schemas for new tables
export const insertRawTelemetryArchiveSchema = createInsertSchema(rawTelemetryArchive).omit({
  id: true,
  receivedAt: true,
});

export const insertEquipmentHeartbeatSchema = createInsertSchema(equipmentHeartbeat).omit({
  updatedAt: true,
});

export const insertTelemetryBatchAckSchema = createInsertSchema(telemetryBatchAck).omit({
  receivedAt: true,
});

export const insertTelemetrySchemaRegistrySchema = createInsertSchema(telemetrySchemaRegistry).omit(
  {
    id: true,
    createdAt: true,
  }
);

// Types for new tables
export type RawTelemetryArchive = typeof rawTelemetryArchive.$inferSelect;
export type InsertRawTelemetryArchive = z.infer<typeof insertRawTelemetryArchiveSchema>;

export type EquipmentHeartbeat = typeof equipmentHeartbeat.$inferSelect;
export type InsertEquipmentHeartbeat = z.infer<typeof insertEquipmentHeartbeatSchema>;

export type TelemetryBatchAck = typeof telemetryBatchAck.$inferSelect;
export type InsertTelemetryBatchAck = z.infer<typeof insertTelemetryBatchAckSchema>;

export type TelemetrySchemaRegistry = typeof telemetrySchemaRegistry.$inferSelect;
export type InsertTelemetrySchemaRegistry = z.infer<typeof insertTelemetrySchemaRegistrySchema>;

// Convenience re-aliases used by server interfaces and OpenAI helpers.
// Keep in sync with server/db/telemetry/types.ts.
export type InsertTelemetry = InsertEquipmentTelemetry;

export interface TelemetryTrend {
  equipmentId: string;
  sensorType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataPoints: number;
  lastReading: Date;
}
