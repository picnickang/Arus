/**
 * SQLite Sensor Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getSensorTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS sensor_configurations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, sensor_name TEXT, unit TEXT, min_value REAL, max_value REAL, warning_threshold REAL, critical_threshold REAL, sampling_rate_seconds INTEGER DEFAULT 60, is_enabled INTEGER DEFAULT 1, calibration_date INTEGER, calibration_due INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sensor_states (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, current_value REAL, status TEXT DEFAULT 'unknown', last_reading_at INTEGER, error_count INTEGER DEFAULT 0, last_error TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS threshold_optimizations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, current_threshold REAL, optimized_threshold REAL, optimization_score REAL, false_positive_reduction REAL, optimization_date INTEGER, applied INTEGER DEFAULT 0, applied_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS vibration_features (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, rms_value REAL, peak_value REAL, crest_factor REAL, kurtosis REAL, dominant_frequency REAL, spectral_centroid REAL, feature_vector TEXT, computed_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sensor_types (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT, unit TEXT, description TEXT, default_min REAL, default_max REAL, default_warning REAL, default_critical REAL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sensor_mapping (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, can_id INTEGER, spn INTEGER, sensor_type TEXT NOT NULL, equipment_id TEXT, unit TEXT, scale_factor REAL DEFAULT 1, offset REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sensor_thresholds (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, threshold_type TEXT NOT NULL, value REAL NOT NULL, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS j1939_configurations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, pgn INTEGER NOT NULL, spn INTEGER NOT NULL, name TEXT NOT NULL, unit TEXT, scale REAL DEFAULT 1, offset REAL DEFAULT 0, min_value REAL, max_value REAL, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS serial_port_states (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, port_path TEXT NOT NULL, device_id TEXT, is_open INTEGER DEFAULT 0, baud_rate INTEGER, last_data_at INTEGER, error_count INTEGER DEFAULT 0, last_error TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS discovered_signals (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, device_id TEXT NOT NULL, can_id INTEGER, pgn INTEGER, spn INTEGER, signal_name TEXT, raw_data TEXT, interpreted_value REAL, first_seen_at INTEGER, last_seen_at INTEGER, occurrence_count INTEGER DEFAULT 1, is_mapped INTEGER DEFAULT 0, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS calibration_cache (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, calibration_data TEXT, computed_at INTEGER, expires_at INTEGER, created_at INTEGER)`,
  ];
}

export function getSensorIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_sensor_configurations_equipment ON sensor_configurations(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sensor_states_equipment ON sensor_states(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_threshold_optimizations_equipment ON threshold_optimizations(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_vibration_features_equipment ON vibration_features(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sensor_mapping_device ON sensor_mapping(device_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_j1939_configurations_device ON j1939_configurations(device_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_discovered_signals_device ON discovered_signals(device_id)`,
  ];
}
