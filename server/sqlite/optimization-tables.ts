/**
 * SQLite Optimization Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getOptimizationTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS optimization_results (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, optimization_type TEXT NOT NULL, input_parameters TEXT, output_results TEXT, objective_value REAL, solver_status TEXT, computation_time_ms INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS optimizer_configurations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, optimizer_type TEXT NOT NULL, config_name TEXT NOT NULL, parameters TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS schedule_optimizations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, vessel_id TEXT, optimization_date INTEGER NOT NULL, optimization_type TEXT NOT NULL, original_schedule TEXT, optimized_schedule TEXT, improvement_percent REAL, constraints_satisfied INTEGER DEFAULT 1, applied INTEGER DEFAULT 0, applied_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS resource_constraints (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, constraint_type TEXT NOT NULL, min_value REAL, max_value REAL, current_value REAL, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getOptimizationIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_optimization_results_type ON optimization_results(optimization_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_optimizer_configurations_type ON optimizer_configurations(optimizer_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_schedule_optimizations_vessel ON schedule_optimizations(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_resource_constraints_resource ON resource_constraints(resource_type, resource_id)`,
  ];
}
