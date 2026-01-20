/**
 * SQLite Digital Twin Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getDigitalTwinTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS digital_twins (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, twin_type TEXT NOT NULL, model_version TEXT, state TEXT, parameters TEXT, last_sync_at INTEGER, sync_status TEXT DEFAULT 'synced', created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS data_quality_metrics (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, completeness_score REAL, accuracy_score REAL, timeliness_score REAL, consistency_score REAL, overall_score REAL, issues_found TEXT, measurement_date INTEGER NOT NULL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS operating_parameters (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, parameter_name TEXT NOT NULL, parameter_type TEXT, min_value REAL, max_value REAL, optimal_value REAL, current_value REAL, unit TEXT, last_updated INTEGER, created_at INTEGER)`,
  ];
}

export function getDigitalTwinIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_digital_twins_equipment ON digital_twins(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_source ON data_quality_metrics(source_type, source_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_operating_parameters_equipment ON operating_parameters(equipment_id)`,
  ];
}
