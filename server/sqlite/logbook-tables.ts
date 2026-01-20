/**
 * SQLite Logbook Tables (Deck & Engine)
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getLogbookTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS deck_log_daily (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT NOT NULL, log_date INTEGER NOT NULL, master_name TEXT, chief_officer_name TEXT, voyage_number TEXT, departure_port TEXT, arrival_port TEXT, weather_summary TEXT, sea_state TEXT, visibility TEXT, wind_direction TEXT, wind_force INTEGER, barometric_pressure REAL, air_temperature REAL, sea_temperature REAL, remarks TEXT, status TEXT DEFAULT 'draft', signed_by TEXT, signed_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS deck_log_hourly (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, log_hour INTEGER NOT NULL, course REAL, speed REAL, rpm REAL, latitude REAL, longitude REAL, weather_code TEXT, wind_direction TEXT, wind_force INTEGER, sea_state TEXT, visibility TEXT, barometric_pressure REAL, air_temperature REAL, sea_temperature REAL, remarks TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS deck_log_watch (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, watch_period TEXT NOT NULL, officer_on_watch TEXT, ab_on_watch TEXT, start_time INTEGER, end_time INTEGER, handover_notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS deck_log_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, event_time INTEGER NOT NULL, event_type TEXT NOT NULL, description TEXT NOT NULL, position_latitude REAL, position_longitude REAL, reported_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS deck_log_hourly_autofill (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, hourly_log_id TEXT NOT NULL, field_name TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, original_value TEXT, autofilled_value TEXT, confidence_score REAL, autofilled_at INTEGER, accepted INTEGER, accepted_by TEXT, accepted_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS engine_log_daily (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT NOT NULL, log_date INTEGER NOT NULL, chief_engineer_name TEXT, second_engineer_name TEXT, me_running_hours REAL, me_fuel_consumption REAL, ae_running_hours TEXT, ae_fuel_consumption TEXT, boiler_running_hours REAL, boiler_fuel_consumption REAL, fo_rob REAL, do_rob REAL, lo_rob REAL, fw_rob REAL, remarks TEXT, status TEXT DEFAULT 'draft', signed_by TEXT, signed_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS engine_log_hourly (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, log_hour INTEGER NOT NULL, me_rpm REAL, me_power REAL, me_exhaust_temp TEXT, me_scav_air_pressure REAL, me_tc_rpm REAL, me_fo_inlet_temp REAL, me_lo_inlet_temp REAL, me_lo_pressure REAL, me_cw_outlet_temp REAL, me_scav_air_temp REAL, shaft_power REAL, propeller_slip REAL, remarks TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS engine_log_generator (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, generator_number INTEGER NOT NULL, log_hour INTEGER NOT NULL, running INTEGER DEFAULT 0, load_kw REAL, frequency REAL, voltage REAL, current REAL, exhaust_temp REAL, lo_pressure REAL, cw_temp REAL, running_hours REAL, remarks TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS engine_log_watch (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, watch_period TEXT NOT NULL, engineer_on_watch TEXT, oiler_on_watch TEXT, start_time INTEGER, end_time INTEGER, handover_notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS engine_log_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_log_id TEXT NOT NULL, event_time INTEGER NOT NULL, event_type TEXT NOT NULL, equipment_id TEXT, description TEXT NOT NULL, action_taken TEXT, reported_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS weather_cache (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, location_key TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, weather_data TEXT NOT NULL, source TEXT DEFAULT 'stormgeo', fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  ];
}

export function getLogbookIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_deck_log_daily_vessel ON deck_log_daily(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_deck_log_daily_date ON deck_log_daily(log_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_deck_log_hourly_daily ON deck_log_hourly(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_deck_log_watch_daily ON deck_log_watch(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_deck_log_events_daily ON deck_log_events(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_engine_log_daily_vessel ON engine_log_daily(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_engine_log_daily_date ON engine_log_daily(log_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_engine_log_hourly_daily ON engine_log_hourly(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_engine_log_generator_daily ON engine_log_generator(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_engine_log_watch_daily ON engine_log_watch(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_engine_log_events_daily ON engine_log_events(daily_log_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_weather_cache_location ON weather_cache(location_key)`,
  ];
}
