/**
 * SQLite Crew Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getCrewTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS crew (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT, name TEXT NOT NULL, rank TEXT NOT NULL, department TEXT, email TEXT, phone TEXT, nationality TEXT, date_of_birth INTEGER, hire_date INTEGER, contract_end_date INTEGER, is_active INTEGER DEFAULT 1, emergency_contact TEXT, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT, description TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_skill (id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, skill_id TEXT NOT NULL, proficiency_level TEXT DEFAULT 'intermediate', certified_date INTEGER, expiry_date INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_leave (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, crew_id TEXT NOT NULL, leave_type TEXT NOT NULL, start_date INTEGER NOT NULL, end_date INTEGER NOT NULL, status TEXT DEFAULT 'pending', approved_by TEXT, approved_at INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS shift_template (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration_hours REAL NOT NULL, is_night_shift INTEGER DEFAULT 0, description TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_assignment (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, crew_id TEXT NOT NULL, work_order_id TEXT, shift_template_id TEXT, assignment_date INTEGER NOT NULL, start_time INTEGER, end_time INTEGER, hours_worked REAL, status TEXT DEFAULT 'scheduled', notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_cert (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, crew_id TEXT NOT NULL, cert_name TEXT NOT NULL, cert_number TEXT, issued_date INTEGER, expiry_date INTEGER, issuing_authority TEXT, document_ref TEXT, status TEXT DEFAULT 'valid', created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_rest_sheet (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, crew_id TEXT NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL, status TEXT DEFAULT 'draft', submitted_at INTEGER, approved_by TEXT, approved_at INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_rest_day (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, sheet_id TEXT NOT NULL, crew_id TEXT NOT NULL, rest_date INTEGER NOT NULL, hours_0_4 INTEGER DEFAULT 0, hours_4_8 INTEGER DEFAULT 0, hours_8_12 INTEGER DEFAULT 0, hours_12_16 INTEGER DEFAULT 0, hours_16_20 INTEGER DEFAULT 0, hours_20_24 INTEGER DEFAULT 0, total_rest_hours REAL, total_work_hours REAL, is_compliant INTEGER DEFAULT 1, violation_type TEXT, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS crew_documents (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, crew_id TEXT NOT NULL, document_type TEXT NOT NULL, document_name TEXT NOT NULL, file_path TEXT, file_size INTEGER, mime_type TEXT, issued_date INTEGER, expires_at INTEGER, notes TEXT, uploaded_by TEXT, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getCrewIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_crew_org ON crew(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_vessel ON crew(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_skill_crew ON crew_skill(crew_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_leave_crew ON crew_leave(crew_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_assignment_crew ON crew_assignment(crew_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_assignment_date ON crew_assignment(assignment_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_cert_crew ON crew_cert(crew_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_rest_sheet_crew ON crew_rest_sheet(crew_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_rest_day_sheet ON crew_rest_day(sheet_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_crew_documents_crew ON crew_documents(crew_id)`,
  ];
}
