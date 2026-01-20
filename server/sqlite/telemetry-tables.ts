/**
 * SQLite Telemetry Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getTelemetryTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS raw_telemetry (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, equipment_id TEXT, ts INTEGER NOT NULL, payload TEXT NOT NULL, processed INTEGER DEFAULT 0, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS edge_heartbeats (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, vessel_id TEXT, ts INTEGER NOT NULL, status TEXT DEFAULT 'online', firmware_version TEXT, uptime_seconds INTEGER, memory_usage REAL, cpu_usage REAL, disk_usage REAL, network_status TEXT, last_sync_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS telemetry_aggregates (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, aggregation_period TEXT NOT NULL, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, sample_count INTEGER, min_value REAL, max_value REAL, avg_value REAL, sum_value REAL, std_dev REAL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS telemetry_retention_policies (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, table_name TEXT NOT NULL, retention_days INTEGER NOT NULL, is_active INTEGER DEFAULT 1, last_cleanup_at INTEGER, rows_deleted INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS telemetry_rollups (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, rollup_type TEXT NOT NULL, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, avg_value REAL, min_value REAL, max_value REAL, count INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS device_registry (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, device_type TEXT NOT NULL, vessel_id TEXT, equipment_ids TEXT, firmware_version TEXT, hardware_version TEXT, mac_address TEXT, ip_address TEXT, last_seen_at INTEGER, status TEXT DEFAULT 'unknown', metadata TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS mqtt_devices (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, client_id TEXT, topic_prefix TEXT, qos INTEGER DEFAULT 1, is_connected INTEGER DEFAULT 0, last_message_at INTEGER, message_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS metrics_history (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, metric_name TEXT NOT NULL, metric_type TEXT NOT NULL, value REAL NOT NULL, labels TEXT, ts INTEGER NOT NULL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS edge_diagnostic_logs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, log_level TEXT NOT NULL, message TEXT NOT NULL, context TEXT, ts INTEGER NOT NULL, created_at INTEGER)`,
  ];
}

export function getTelemetryIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_raw_telemetry_device ON raw_telemetry(device_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_raw_telemetry_ts ON raw_telemetry(ts)`,
    sql`CREATE INDEX IF NOT EXISTS idx_edge_heartbeats_device ON edge_heartbeats(device_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_edge_heartbeats_ts ON edge_heartbeats(ts)`,
    sql`CREATE INDEX IF NOT EXISTS idx_telemetry_aggregates_equipment ON telemetry_aggregates(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_telemetry_rollups_equipment ON telemetry_rollups(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_device_registry_device ON device_registry(device_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_mqtt_devices_device ON mqtt_devices(device_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_metrics_history_name ON metrics_history(metric_name)`,
  ];
}
