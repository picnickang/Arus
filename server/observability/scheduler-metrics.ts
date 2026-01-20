import client from "prom-client";

// Scheduler run duration
export const schedRunDuration = new client.Histogram({
  name: "arus_scheduler_run_duration_ms",
  help: "Scheduler run duration in milliseconds",
  buckets: [50, 100, 250, 500, 1000, 2000, 4000, 8000],
  labelNames: ["org_id", "mode", "trigger"],
});

// Unfilled positions counter
export const schedUnfilledTotal = new client.Counter({
  name: "arus_scheduler_unfilled_total",
  help: "Total unfilled positions across all runs",
  labelNames: ["org_id", "vessel_id"],
});

// Unfilled by reason
export const schedUnfilledReason = new client.Counter({
  name: "arus_scheduler_unfilled_reason_total",
  help: "Unfilled positions grouped by reason",
  labelNames: ["org_id", "reason"],
});

// Scheduler runs total
export const schedRunsTotal = new client.Counter({
  name: "arus_scheduler_runs_total",
  help: "Total scheduler runs",
  labelNames: ["org_id", "mode", "trigger", "status"],
});

// Assigned shifts
export const schedAssignedShifts = new client.Counter({
  name: "arus_scheduler_assigned_shifts_total",
  help: "Total shifts successfully assigned",
  labelNames: ["org_id", "vessel_id"],
});

// Auto-replan triggers
export const schedAutoReplanTriggers = new client.Counter({
  name: "arus_scheduler_auto_replan_triggers_total",
  help: "Count of auto-replan triggers by source",
  labelNames: ["org_id", "trigger_type"],
});

// Coverage percentage gauge
export const schedCoveragePercent = new client.Gauge({
  name: "arus_scheduler_coverage_percent",
  help: "Percentage of shifts successfully assigned in last run",
  labelNames: ["org_id"],
});

// Deduplication metrics
export const schedDeduplicatedRuns = new client.Counter({
  name: "arus_scheduler_deduplicated_runs_total",
  help: "Total scheduler runs skipped due to deduplication",
  labelNames: ["org_id", "mode"],
});

// Assignment cleanup metrics
export const schedCleanupAssignments = new client.Counter({
  name: "arus_scheduler_cleanup_assignments_total",
  help: "Total assignments deleted during cleanup",
  labelNames: ["org_id", "mode"],
});

// Error counters for scheduler failures
export const schedErrors = new client.Counter({
  name: "arus_scheduler_errors_total",
  help: "Total scheduler errors by error type",
  labelNames: ["org_id", "error_type", "mode"],
});

// Constraint violations detected during scheduling
export const schedConstraintViolations = new client.Counter({
  name: "arus_scheduler_constraint_violations_total",
  help: "Total constraint violations detected",
  labelNames: ["org_id", "constraint_type"],
});

// Crew utilization histogram (avoids per-crew-member cardinality explosion)
export const schedCrewUtilization = new client.Histogram({
  name: "arus_scheduler_crew_utilization_percent",
  help: "Distribution of crew utilization percentages across fleet",
  labelNames: ["org_id"],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

// Position demand gauge
export const schedPositionDemand = new client.Gauge({
  name: "arus_scheduler_position_demand",
  help: "Number of positions requiring staffing in last run",
  labelNames: ["org_id", "vessel_id", "position_type"],
});

// PdM event processing
export const schedPdmEvents = new client.Counter({
  name: "arus_scheduler_pdm_events_total",
  help: "Total PdM events processed by scheduler",
  labelNames: ["org_id", "event_type", "action"],
});
