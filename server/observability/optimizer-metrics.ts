import client from "prom-client";

// LP Optimizer run duration
export const optimizerRunDuration = new client.Histogram({
  name: "arus_lp_optimizer_run_duration_ms",
  help: "LP Optimizer run duration in milliseconds",
  buckets: [100, 250, 500, 1000, 2000, 4000, 8000, 16000],
  labelNames: ["org_id", "feasible"],
});

// Jobs scheduled counter
export const optimizerJobsScheduled = new client.Counter({
  name: "arus_lp_optimizer_jobs_scheduled_total",
  help: "Total maintenance jobs successfully scheduled",
  labelNames: ["org_id", "priority"],
});

// Jobs unscheduled counter
export const optimizerJobsUnscheduled = new client.Counter({
  name: "arus_lp_optimizer_jobs_unscheduled_total",
  help: "Total jobs that could not be scheduled",
  labelNames: ["org_id", "reason"],
});

// Optimizer runs total
export const optimizerRunsTotal = new client.Counter({
  name: "arus_lp_optimizer_runs_total",
  help: "Total LP optimizer runs",
  labelNames: ["org_id", "status", "feasible"],
});

// Constraint violations
export const optimizerConstraintViolations = new client.Counter({
  name: "arus_lp_optimizer_constraint_violations_total",
  help: "Total constraint violations detected",
  labelNames: ["org_id", "constraint_type"],
});

// Optimization objective value gauge
export const optimizerObjectiveValue = new client.Gauge({
  name: "arus_lp_optimizer_objective_value",
  help: "Optimization objective value (total cost) from last run",
  labelNames: ["org_id"],
});

// Resource utilization gauge
export const optimizerCrewUtilization = new client.Gauge({
  name: "arus_lp_optimizer_crew_utilization_percent",
  help: "Crew utilization percentage from last run",
  labelNames: ["org_id", "crew_member"],
});

// Parts budget utilization gauge
export const optimizerPartsBudgetUtilization = new client.Gauge({
  name: "arus_lp_optimizer_parts_budget_utilization_percent",
  help: "Parts budget utilization percentage from last run",
  labelNames: ["org_id"],
});

// Relaxation counter (when constraints are relaxed)
export const optimizerRelaxations = new client.Counter({
  name: "arus_lp_optimizer_relaxations_total",
  help: "Total number of times constraints were relaxed to find a solution",
  labelNames: ["org_id"],
});
