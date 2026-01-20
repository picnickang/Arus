/**
 * SQLite Inventory Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getInventoryTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS parts_inventory (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, part_number TEXT NOT NULL, description TEXT, category TEXT, manufacturer TEXT, unit_cost REAL, currency TEXT DEFAULT 'SGD', min_quantity INTEGER DEFAULT 0, current_quantity INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 5, lead_time_days INTEGER, storage_location TEXT, is_critical INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS stock (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, part_id TEXT NOT NULL, vessel_id TEXT, location TEXT, quantity INTEGER NOT NULL DEFAULT 0, min_quantity INTEGER DEFAULT 0, max_quantity INTEGER, last_count_date INTEGER, last_count_by TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS inventory_movements (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, part_id TEXT NOT NULL, vessel_id TEXT, movement_type TEXT NOT NULL, quantity INTEGER NOT NULL, reference_type TEXT, reference_id TEXT, notes TEXT, performed_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, contact_name TEXT, email TEXT, phone TEXT, address TEXT, country TEXT, payment_terms TEXT, rating INTEGER, is_preferred INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS purchase_orders (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, po_number TEXT NOT NULL, supplier_id TEXT NOT NULL, vessel_id TEXT, status TEXT DEFAULT 'draft', total_amount REAL, currency TEXT DEFAULT 'SGD', ordered_by TEXT, ordered_at INTEGER, expected_delivery INTEGER, actual_delivery INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS purchase_order_items (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, purchase_order_id TEXT NOT NULL, part_id TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, total_price REAL NOT NULL, received_quantity INTEGER DEFAULT 0, notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS parts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, part_number TEXT NOT NULL, name TEXT NOT NULL, description TEXT, category TEXT, subcategory TEXT, manufacturer TEXT, supplier_id TEXT, unit_cost REAL DEFAULT 0, currency TEXT DEFAULT 'SGD', unit_of_measure TEXT DEFAULT 'each', min_stock_level INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 5, lead_time_days INTEGER DEFAULT 7, storage_location TEXT, is_critical INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, specifications TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS inventory_parts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT, part_id TEXT NOT NULL, location TEXT, quantity INTEGER NOT NULL DEFAULT 0, reserved_quantity INTEGER DEFAULT 0, min_quantity INTEGER DEFAULT 0, max_quantity INTEGER, last_replenished INTEGER, expiry_date INTEGER, batch_number TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS part_substitutions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, original_part_id TEXT NOT NULL, substitute_part_id TEXT NOT NULL, substitution_type TEXT DEFAULT 'equivalent', notes TEXT, is_approved INTEGER DEFAULT 0, approved_by TEXT, approved_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS part_failure_history (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, part_id TEXT NOT NULL, equipment_id TEXT, failure_date INTEGER NOT NULL, failure_mode TEXT, root_cause TEXT, corrective_action TEXT, mtbf_hours REAL, work_order_id TEXT, notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, part_id TEXT NOT NULL, vessel_id TEXT, work_order_id TEXT NOT NULL, quantity INTEGER NOT NULL, reserved_by TEXT, reserved_at INTEGER, expires_at INTEGER, status TEXT DEFAULT 'active', notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS storage_config (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, config_type TEXT NOT NULL, config_key TEXT NOT NULL, config_value TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getInventoryIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_parts_inventory_org ON parts_inventory(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_stock_org ON stock(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_stock_part ON stock(part_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_inventory_movements_part ON inventory_movements(part_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_parts_org ON parts(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_inventory_parts_org ON inventory_parts(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_reservations_work_order ON reservations(work_order_id)`,
  ];
}
