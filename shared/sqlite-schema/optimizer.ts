/**
 * SQLite Schema Optimizer Module
 * Optimizer configurations, results, resource constraints, schedule optimizations
 */

import { sqliteTable, text, integer, real, index } from "./base";

export const optimizerConfigurationsSqlite = sqliteTable(
  "optimizer_configurations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    optimizerType: text("optimizer_type").notNull(),
    objectives: text("objectives"),
    constraints: text("constraints"),
    parameters: text("parameters"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgIdx: index("idx_oc_org").on(table.orgId),
    typeIdx: index("idx_oc_type").on(table.optimizerType),
  })
);

export const optimizationResultsSqlite = sqliteTable(
  "optimization_results",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    configurationId: text("configuration_id").notNull(),
    runDate: integer("run_date", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("completed"),
    objectiveValue: real("objective_value"),
    solutionData: text("solution_data"),
    constraintsSatisfied: integer("constraints_satisfied", { mode: "boolean" }),
    executionTimeMs: integer("execution_time_ms"),
    iterations: integer("iterations"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    configIdx: index("idx_or_config").on(table.configurationId),
    runDateIdx: index("idx_or_run_date").on(table.runDate),
  })
);

export const resourceConstraintsSqlite = sqliteTable(
  "resource_constraints",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    constraintType: text("constraint_type").notNull(),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    unit: text("unit"),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    resourceIdx: index("idx_rc_resource").on(table.resourceType, table.resourceId),
  })
);

export const scheduleOptimizationsSqlite = sqliteTable(
  "schedule_optimizations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    vesselId: text("vessel_id"),
    optimizationType: text("optimization_type").notNull(),
    periodStart: integer("period_start", { mode: "timestamp" }),
    periodEnd: integer("period_end", { mode: "timestamp" }),
    status: text("status").notNull().default("pending"),
    inputData: text("input_data"),
    outputSchedule: text("output_schedule"),
    savingsEstimate: real("savings_estimate"),
    executedAt: integer("executed_at", { mode: "timestamp" }),
    executionTimeMs: integer("execution_time_ms"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (table) => ({
    vesselIdx: index("idx_so_vessel").on(table.vesselId),
    typeIdx: index("idx_so_type").on(table.optimizationType),
  })
);
