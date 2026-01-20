/**
 * SQLite Work Order Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getWorkOrderTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS work_orders (id TEXT PRIMARY KEY, wo_number TEXT, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, vessel_id TEXT, status TEXT NOT NULL DEFAULT 'open', priority INTEGER NOT NULL DEFAULT 3, maintenance_type TEXT, reason TEXT, description TEXT, estimated_hours REAL, actual_hours REAL, estimated_cost_per_hour REAL, actual_cost_per_hour REAL, estimated_downtime_hours REAL, actual_downtime_hours REAL, total_parts_cost REAL DEFAULT 0, total_labor_cost REAL DEFAULT 0, total_cost REAL DEFAULT 0, roi REAL, downtime_cost_per_hour REAL, affects_vessel_downtime INTEGER DEFAULT 0, vessel_downtime_started_at INTEGER, assigned_crew_id TEXT, required_skills TEXT, labor_hours REAL, labor_cost REAL, port_call_id TEXT, drydock_window_id TEXT, maintenance_window TEXT, maintenance_template_id TEXT, schedule_id TEXT, planned_start_date INTEGER, planned_end_date INTEGER, actual_start_date INTEGER, actual_end_date INTEGER, created_at INTEGER, updated_at INTEGER, version INTEGER DEFAULT 1, last_modified_by TEXT, last_modified_device TEXT)`,
    sql`CREATE TABLE IF NOT EXISTS work_order_completions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, work_order_id TEXT NOT NULL, equipment_id TEXT NOT NULL, vessel_id TEXT, completed_at INTEGER NOT NULL, completed_by TEXT, completed_by_name TEXT, actual_duration_minutes INTEGER, estimated_duration_minutes INTEGER, planned_start_date INTEGER, planned_end_date INTEGER, actual_start_date INTEGER, actual_end_date INTEGER, total_cost REAL DEFAULT 0, total_parts_cost REAL DEFAULT 0, total_labor_cost REAL DEFAULT 0, estimated_downtime_hours REAL, actual_downtime_hours REAL, affects_vessel_downtime INTEGER DEFAULT 0, vessel_downtime_hours REAL, parts_used TEXT, parts_count INTEGER DEFAULT 0, completion_status TEXT DEFAULT 'completed', compliance_flags TEXT, quality_check_passed INTEGER, notes TEXT, predictive_context TEXT, maintenance_schedule_id TEXT, maintenance_type TEXT, on_time_completion INTEGER, duration_variance_percent REAL, cost_variance_percent REAL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS work_order_parts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, work_order_id TEXT NOT NULL, part_id TEXT NOT NULL, quantity_used INTEGER NOT NULL, unit_cost REAL NOT NULL, total_cost REAL NOT NULL, used_by TEXT NOT NULL, used_at INTEGER, notes TEXT, supplier_id TEXT, estimated_delivery_date INTEGER, actual_delivery_date INTEGER, actual_cost REAL, delivery_status TEXT DEFAULT 'pending', created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS work_order_checklists (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, work_order_id TEXT NOT NULL, equipment_id TEXT NOT NULL, item_key TEXT NOT NULL, item_label TEXT NOT NULL, item_type TEXT DEFAULT 'boolean', is_required INTEGER DEFAULT 1, display_order INTEGER DEFAULT 0, current_value TEXT, is_completed INTEGER DEFAULT 0, completed_at INTEGER, completed_by TEXT, notes TEXT, compliance_category TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS work_order_worklogs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, work_order_id TEXT NOT NULL, log_type TEXT NOT NULL, message TEXT NOT NULL, logged_by TEXT NOT NULL, logged_by_name TEXT, hours_logged REAL, parts_used TEXT, labor_cost REAL, attachments TEXT, created_at INTEGER)`,
  ];
}

export function getWorkOrderIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_work_orders_org ON work_orders(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_orders_equipment ON work_orders(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_orders_created ON work_orders(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_order_completions_org ON work_order_completions(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_order_completions_wo ON work_order_completions(work_order_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_order_parts_wo ON work_order_parts(work_order_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_order_checklists_wo ON work_order_checklists(work_order_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_work_order_worklogs_wo ON work_order_worklogs(work_order_id)`,
  ];
}
