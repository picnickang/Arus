/**
 * SQLite Schema Telemetry Module
 * Equipment telemetry, raw telemetry, aggregates, rollups
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const equipmentTelemetrySqlite = sqliteTable(
  "equipment_telemetry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    threshold: real("threshold"),
    status: text("status").notNull().default("normal"),
  },
  (table) => ({
    orgIdx: index("idx_telemetry_org").on(table.orgId),
    equipmentTsIdx: index("idx_telemetry_equipment_ts").on(table.equipmentId, table.ts),
    sensorTsIdx: index("idx_telemetry_sensor_ts").on(table.sensorType, table.ts),
    statusIdx: index("idx_telemetry_status").on(table.status),
  })
);

export const rawTelemetrySqlite = sqliteTable(
  "raw_telemetry",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    rawValue: text("raw_value"),
    processedValue: real("processed_value"),
    unit: text("unit"),
    quality: text("quality"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentTsIdx: index("idx_raw_equipment_ts").on(table.equipmentId, table.ts),
  })
);

export const telemetryAggregatesSqlite = sqliteTable(
  "telemetry_aggregates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
    periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
    aggregationType: text("aggregation_type").notNull(),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    avgValue: real("avg_value"),
    sumValue: real("sum_value"),
    sampleCount: integer("sample_count"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentPeriodIdx: index("idx_agg_equipment_period").on(table.equipmentId, table.periodStart),
  })
);

export const telemetryRollupsSqlite = sqliteTable(
  "telemetry_rollups",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    equipmentId: text("equipment_id").notNull(),
    sensorType: text("sensor_type").notNull(),
    rollupDate: integer("rollup_date", { mode: "timestamp" }).notNull(),
    rollupType: text("rollup_type").notNull(),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    avgValue: real("avg_value"),
    stdDev: real("std_dev"),
    sampleCount: integer("sample_count"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    equipmentDateIdx: index("idx_rollup_equipment_date").on(table.equipmentId, table.rollupDate),
  })
);

export const edgeHeartbeatsSqlite = sqliteTable(
  "edge_heartbeats",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    ts: integer("ts", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("healthy"),
    cpuUsage: real("cpu_usage"),
    memoryUsage: real("memory_usage"),
    diskUsage: real("disk_usage"),
    networkLatency: real("network_latency"),
    errorCount: integer("error_count").default(0),
    metadata: text("metadata"),
  },
  (table) => ({
    deviceTsIdx: index("idx_heartbeat_device_ts").on(table.deviceId, table.ts),
  })
);
