/**
 * SQLite Vessel Tables - Vessels, Equipment, Devices, Telemetry
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getVesselTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS vessels (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, imo TEXT, flag TEXT, vessel_type TEXT, vessel_class TEXT, condition TEXT DEFAULT 'good', online_status TEXT DEFAULT 'unknown', last_heartbeat INTEGER, dwt INTEGER, year_built INTEGER, active INTEGER DEFAULT 1, notes TEXT, day_rate_sgd REAL, downtime_days REAL DEFAULT 0, downtime_reset_at INTEGER, operation_days REAL DEFAULT 0, operation_reset_at INTEGER, last_daily_update_date TEXT, commission_date INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS equipment (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT, vessel_name TEXT, name TEXT NOT NULL, plain_language_name TEXT, type TEXT NOT NULL, system_type TEXT, component_type TEXT, criticality_level TEXT DEFAULT 'medium', manufacturer TEXT, model TEXT, serial_number TEXT, location TEXT, is_active INTEGER DEFAULT 1, specifications TEXT, operating_parameters TEXT, maintenance_schedule TEXT, emergency_labor_multiplier REAL, emergency_parts_multiplier REAL, emergency_downtime_multiplier REAL, created_at INTEGER, updated_at INTEGER, version INTEGER DEFAULT 1, last_modified_by TEXT, last_modified_device TEXT)`,
    sql`CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT, label TEXT, vessel TEXT, buses TEXT, sensors TEXT, config TEXT, hmac_key TEXT, device_type TEXT DEFAULT 'generic', j1939_config TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS equipment_telemetry (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, ts INTEGER NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, value REAL NOT NULL, unit TEXT NOT NULL, threshold REAL, status TEXT NOT NULL DEFAULT 'normal')`,
    sql`CREATE TABLE IF NOT EXISTS downtime_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, work_order_id TEXT, equipment_id TEXT, vessel_id TEXT, downtime_type TEXT NOT NULL, start_time INTEGER NOT NULL, end_time INTEGER, duration_hours REAL, reason TEXT, impact_level TEXT DEFAULT 'medium', revenue_impact REAL, opportunity_cost REAL, root_cause TEXT, preventable INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS equipment_lifecycle (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, event_type TEXT NOT NULL, event_date INTEGER NOT NULL, description TEXT, performed_by TEXT, cost REAL, document_ref TEXT, warranty_status TEXT, mtbf_impact REAL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS performance_metrics (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, metric_date INTEGER NOT NULL, availability REAL, mtbf_hours REAL, mttr_hours REAL, oee REAL, utilization REAL, energy_efficiency REAL, cost_per_operating_hour REAL, maintenance_cost_ratio REAL, unplanned_downtime_ratio REAL, created_at INTEGER)`,
  ];
}

export function getVesselIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_vessels_org ON vessels(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_equipment_org ON equipment(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_equipment_vessel ON equipment(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_equipment ON equipment_telemetry(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_ts ON equipment_telemetry(ts)`,
    sql`CREATE INDEX IF NOT EXISTS idx_downtime_events_equipment ON downtime_events(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_downtime_events_vessel ON downtime_events(vessel_id)`,
  ];
}
