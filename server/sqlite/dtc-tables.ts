/**
 * SQLite DTC (Diagnostic Trouble Code) Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getDtcTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS dtc_definitions (id TEXT PRIMARY KEY, org_id TEXT, code TEXT NOT NULL, description TEXT NOT NULL, severity TEXT NOT NULL, system TEXT, subsystem TEXT, probable_causes TEXT, diagnostic_steps TEXT, repair_procedures TEXT, parts_needed TEXT, estimated_repair_hours REAL, safety_critical INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS dtc_faults (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, device_id TEXT, dtc_code TEXT NOT NULL, description TEXT, severity TEXT NOT NULL, first_occurrence INTEGER NOT NULL, last_occurrence INTEGER, occurrence_count INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, resolved_at INTEGER, resolved_by TEXT, resolution_notes TEXT, work_order_id TEXT, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getDtcIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_dtc_definitions_code ON dtc_definitions(code)`,
    sql`CREATE INDEX IF NOT EXISTS idx_dtc_faults_equipment ON dtc_faults(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_dtc_faults_active ON dtc_faults(is_active)`,
    sql`CREATE INDEX IF NOT EXISTS idx_dtc_faults_code ON dtc_faults(dtc_code)`,
  ];
}
