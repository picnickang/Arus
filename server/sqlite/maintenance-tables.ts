/**
 * SQLite Maintenance Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getMaintenanceTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS maintenance_schedules (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, schedule_type TEXT NOT NULL, interval_days INTEGER, interval_hours INTEGER, last_performed INTEGER, next_due INTEGER, priority INTEGER DEFAULT 3, description TEXT, maintenance_type TEXT, notes TEXT, source TEXT DEFAULT 'manual', created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS maintenance_records (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, work_order_id TEXT, maintenance_type TEXT NOT NULL, performed_at INTEGER NOT NULL, performed_by TEXT, duration_hours REAL, cost REAL, parts_used TEXT, notes TEXT, next_due INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS maintenance_costs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, cost_type TEXT NOT NULL, amount REAL NOT NULL, currency TEXT DEFAULT 'SGD', description TEXT, work_order_id TEXT, incurred_at INTEGER NOT NULL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS maintenance_templates (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, equipment_type TEXT NOT NULL, maintenance_type TEXT NOT NULL, interval_days INTEGER, interval_hours INTEGER, estimated_duration_hours REAL, required_skills TEXT, parts_list TEXT, instructions TEXT, safety_notes TEXT, compliance_requirements TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS maintenance_checklist_items (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, template_id TEXT NOT NULL, item_key TEXT NOT NULL, item_label TEXT NOT NULL, item_type TEXT DEFAULT 'boolean', options TEXT, is_required INTEGER DEFAULT 1, display_order INTEGER DEFAULT 0, compliance_category TEXT, safety_critical INTEGER DEFAULT 0, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS maintenance_checklist_completions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, work_order_id TEXT NOT NULL, checklist_item_id TEXT NOT NULL, value TEXT, completed_by TEXT, completed_at INTEGER, notes TEXT, photo_evidence TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS maintenance_windows (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT NOT NULL, window_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, start_date INTEGER NOT NULL, end_date INTEGER NOT NULL, status TEXT DEFAULT 'scheduled', location TEXT, estimated_cost REAL, actual_cost REAL, work_orders TEXT, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS port_call (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT NOT NULL, port_name TEXT NOT NULL, arrival_date INTEGER, departure_date INTEGER, purpose TEXT, status TEXT DEFAULT 'scheduled', notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS drydock_window (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT NOT NULL, facility_name TEXT, start_date INTEGER NOT NULL, end_date INTEGER NOT NULL, purpose TEXT, status TEXT DEFAULT 'scheduled', estimated_cost REAL, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT, vessel_id TEXT, work_order_id TEXT, expense_type TEXT NOT NULL, amount REAL NOT NULL, currency TEXT DEFAULT 'SGD', description TEXT, vendor TEXT, receipt_ref TEXT, approved_by TEXT, approved_at INTEGER, expense_date INTEGER NOT NULL, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS labor_rates (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, role TEXT NOT NULL, skill_level TEXT DEFAULT 'standard', hourly_rate REAL NOT NULL, overtime_multiplier REAL DEFAULT 1.5, currency TEXT DEFAULT 'SGD', effective_from INTEGER, effective_to INTEGER, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getMaintenanceIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_org ON maintenance_schedules(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_equipment ON maintenance_schedules(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next ON maintenance_schedules(next_due)`,
    sql`CREATE INDEX IF NOT EXISTS idx_maintenance_records_equipment ON maintenance_records(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_maintenance_templates_org ON maintenance_templates(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_maintenance_windows_vessel ON maintenance_windows(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_port_call_vessel ON port_call(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_drydock_window_vessel ON drydock_window(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_labor_rates_org ON labor_rates(org_id)`,
  ];
}
