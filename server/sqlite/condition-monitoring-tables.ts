/**
 * SQLite Condition Monitoring Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getConditionMonitoringTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS condition_monitoring (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, monitoring_type TEXT NOT NULL, measurement_date INTEGER NOT NULL, status TEXT NOT NULL, health_score REAL, findings TEXT, recommendations TEXT, next_scheduled INTEGER, performed_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS oil_analysis (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sample_date INTEGER NOT NULL, sample_number TEXT, lab_name TEXT, viscosity_40c REAL, viscosity_100c REAL, tbn REAL, tan REAL, water_content_ppm REAL, fuel_dilution_percent REAL, soot_percent REAL, oxidation REAL, nitration REAL, iron_ppm REAL, copper_ppm REAL, lead_ppm REAL, aluminum_ppm REAL, chromium_ppm REAL, tin_ppm REAL, silicon_ppm REAL, sodium_ppm REAL, potassium_ppm REAL, overall_condition TEXT, recommendations TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS vibration_analysis (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, measurement_date INTEGER NOT NULL, measurement_point TEXT, overall_velocity REAL, overall_acceleration REAL, dominant_frequency REAL, spectral_data TEXT, bearing_condition TEXT, imbalance_severity TEXT, misalignment_severity TEXT, looseness_severity TEXT, overall_condition TEXT, recommendations TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS wear_particle_analysis (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sample_date INTEGER NOT NULL, sample_number TEXT, particle_count_4um INTEGER, particle_count_6um INTEGER, particle_count_14um INTEGER, particle_count_21um INTEGER, iso_code TEXT, ferrous_debris_index REAL, particle_size_distribution TEXT, wear_mode TEXT, severity TEXT, source_component TEXT, recommendations TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS oil_change_records (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, change_date INTEGER NOT NULL, oil_type TEXT, oil_brand TEXT, quantity_liters REAL, filter_changed INTEGER DEFAULT 0, filter_type TEXT, performed_by TEXT, work_order_id TEXT, running_hours_at_change REAL, next_change_hours REAL, notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS industry_benchmarks (id TEXT PRIMARY KEY, org_id TEXT, equipment_type TEXT NOT NULL, metric_name TEXT NOT NULL, benchmark_value REAL NOT NULL, unit TEXT, percentile INTEGER, source TEXT, valid_from INTEGER, valid_to INTEGER, created_at INTEGER)`,
  ];
}

export function getConditionMonitoringIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_condition_monitoring_equipment ON condition_monitoring(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_oil_analysis_equipment ON oil_analysis(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_oil_analysis_date ON oil_analysis(sample_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_vibration_analysis_equipment ON vibration_analysis(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_wear_particle_analysis_equipment ON wear_particle_analysis(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_oil_change_records_equipment ON oil_change_records(equipment_id)`,
  ];
}
