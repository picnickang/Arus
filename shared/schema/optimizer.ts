/**
 * Schema Optimizer - Scheduling Optimization Configuration and Results
 *
 * Optimizer configurations, resource constraints, and optimization results.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  createInsertSchema,
  z,
} from "./base";

// Optimizer configurations
export const optimizerConfigurations = pgTable("optimizer_configurations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  algorithmType: text("algorithm_type").notNull().default("greedy"),
  enabled: boolean("enabled").default(true),
  config: text("config").notNull(),
  maxSchedulingHorizon: integer("max_scheduling_horizon").default(90),
  costWeightFactor: real("cost_weight_factor").default(0.4),
  urgencyWeightFactor: real("urgency_weight_factor").default(0.6),
  resourceConstraintStrict: boolean("resource_constraint_strict").default(true),
  conflictResolutionStrategy: text("conflict_resolution_strategy").default("priority_based"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Resource constraints
export const resourceConstraints = pgTable("resource_constraints", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  resourceName: text("resource_name").notNull(),
  availabilityWindow: text("availability_window").notNull(),
  maxConcurrentTasks: integer("max_concurrent_tasks").default(1),
  costPerHour: real("cost_per_hour"),
  costPerUnit: real("cost_per_unit"),
  skills: text("skills"),
  restrictions: text("restrictions"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Optimization results
export const optimizationResults = pgTable("optimization_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  configurationId: text("configuration_id").notNull(),
  runStatus: text("run_status").notNull().default("pending"),
  startTime: timestamp("start_time", { mode: "date" }).defaultNow(),
  endTime: timestamp("end_time", { mode: "date" }),
  executionTimeMs: integer("execution_time_ms"),
  equipmentScope: text("equipment_scope"),
  timeHorizon: integer("time_horizon"),
  totalSchedules: integer("total_schedules").default(0),
  totalCostEstimate: real("total_cost_estimate"),
  costSavings: real("cost_savings"),
  resourceUtilization: text("resource_utilization"),
  conflictsResolved: integer("conflicts_resolved").default(0),
  optimizationScore: real("optimization_score"),
  algorithmMetrics: text("algorithm_metrics"),
  recommendations: text("recommendations"),
  appliedToProduction: boolean("applied_to_production").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Schedule optimizations
export const scheduleOptimizations = pgTable("schedule_optimizations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  optimizationResultId: text("optimization_result_id").notNull(),
  equipmentId: text("equipment_id").notNull(),
  currentScheduleId: text("current_schedule_id"),
  recommendedScheduleDate: timestamp("recommended_schedule_date", { mode: "date" }).notNull(),
  recommendedMaintenanceType: text("recommended_maintenance_type").notNull(),
  recommendedPriority: integer("recommended_priority").notNull(),
  estimatedDuration: integer("estimated_duration"),
  estimatedCost: real("estimated_cost"),
  assignedTechnicianId: text("assigned_technician_id"),
  requiredParts: text("required_parts"),
  optimizationReason: text("optimization_reason"),
  conflictsWith: text("conflicts_with"),
  priority: real("priority").notNull().default(50),
  status: text("status").notNull().default("pending"),
  appliedAt: timestamp("applied_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Scheduler runs - matches existing database structure
export const schedulerRuns = pgTable("scheduler_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  vesselId: varchar("vessel_id"),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  finishedAt: timestamp("finished_at", { mode: "date" }),
  mode: varchar("mode").notNull().default("dry_run"),
  inputHash: varchar("input_hash").notNull(),
  stats: jsonb("stats"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  status: varchar("status").notNull().default("draft"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  publishedAt: timestamp("published_at", { mode: "date" }),
  publishedBy: varchar("published_by"),
  horGenerated: boolean("hor_generated").default(false),
  horGeneratedAt: timestamp("hor_generated_at", { mode: "date" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Schedule assignments
export const scheduleAssignments = pgTable("schedule_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  runId: varchar("run_id")
    .notNull()
    .references(() => schedulerRuns.id),
  crewId: varchar("crew_id").notNull(),
  shiftId: varchar("shift_id").notNull(),
  date: timestamp("date", { mode: "date" }).notNull(),
  assignmentType: text("assignment_type").notNull(),
  score: real("score"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Schedule unfilled slots
export const scheduleUnfilled = pgTable("schedule_unfilled", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  runId: varchar("run_id")
    .notNull()
    .references(() => schedulerRuns.id),
  shiftId: varchar("shift_id").notNull(),
  date: timestamp("date", { mode: "date" }).notNull(),
  reason: text("reason").notNull(),
  requiredSkills: text("required_skills").array(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Insert schemas
export const insertOptimizerConfigurationSchema = createInsertSchema(optimizerConfigurations)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    algorithmType: z.enum(["greedy", "genetic", "simulated_annealing"]).default("greedy"),
    conflictResolutionStrategy: z
      .enum(["priority_based", "cost_based", "earliest_first"])
      .default("priority_based"),
  });

export const insertResourceConstraintSchema = createInsertSchema(resourceConstraints)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    resourceType: z.enum(["technician", "part", "tool", "facility"]),
  });

export const insertOptimizationResultSchema = createInsertSchema(optimizationResults)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    runStatus: z.enum(["pending", "running", "completed", "failed"]).default("pending"),
  });

export const insertScheduleOptimizationSchema = createInsertSchema(scheduleOptimizations)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: z.enum(["pending", "approved", "rejected", "applied"]).default("pending"),
  });

// Types
export type OptimizerConfiguration = typeof optimizerConfigurations.$inferSelect;
export type InsertOptimizerConfiguration = z.infer<typeof insertOptimizerConfigurationSchema>;
export type ResourceConstraint = typeof resourceConstraints.$inferSelect;
export type InsertResourceConstraint = z.infer<typeof insertResourceConstraintSchema>;
export type OptimizationResult = typeof optimizationResults.$inferSelect;
export type InsertOptimizationResult = z.infer<typeof insertOptimizationResultSchema>;
export type ScheduleOptimization = typeof scheduleOptimizations.$inferSelect;
export type InsertScheduleOptimization = z.infer<typeof insertScheduleOptimizationSchema>;
export type SchedulerRun = typeof schedulerRuns.$inferSelect;
export type ScheduleAssignment = typeof scheduleAssignments.$inferSelect;
export type ScheduleUnfilled = typeof scheduleUnfilled.$inferSelect;
