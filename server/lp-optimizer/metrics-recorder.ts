/**
 * LP Optimizer - Metrics Recording
 */

import {
  optimizerRunDuration,
  optimizerJobsScheduled,
  optimizerJobsUnscheduled,
  optimizerRunsTotal,
  optimizerConstraintViolations,
  optimizerObjectiveValue,
  optimizerCrewUtilization,
  optimizerPartsBudgetUtilization,
} from "../observability/optimizer-metrics.js";
import type { OptimizationResult, MaintenanceJob } from "./types.js";

export function recordOptimizationMetrics(
  orgId: string,
  result: OptimizationResult,
  jobs: MaintenanceJob[]
): void {
  const feasible = result.constraints.feasible ? "true" : "false";
  const status = result.success ? "success" : "failure";

  optimizerRunDuration.observe({ org_id: orgId, feasible }, result.optimizationTime);
  optimizerRunsTotal.inc({ org_id: orgId, status, feasible });

  const priorityMap: { [key: number]: string } = {
    1: "critical",
    2: "high",
    3: "medium",
    4: "low",
  };

  for (const scheduledJob of result.schedule) {
    const priorityLabel = priorityMap[scheduledJob.priority] || "unknown";
    optimizerJobsScheduled.inc({ org_id: orgId, priority: priorityLabel });
  }

  const scheduledJobIds = new Set(result.schedule.map((s) => s.jobId));
  const unscheduledJobs = jobs.filter((j) => !scheduledJobIds.has(j.id));

  for (const _unscheduledJob of unscheduledJobs) {
    const reason = result.constraints.feasible ? "low_priority" : "infeasible";
    optimizerJobsUnscheduled.inc({ org_id: orgId, reason });
  }

  for (const violation of result.constraints.violations) {
    const constraintType = violation.includes("capacity")
      ? "capacity"
      : violation.includes("budget")
        ? "budget"
        : violation.includes("skill")
          ? "skill"
          : violation.includes("overlap")
            ? "overlap"
            : "other";
    optimizerConstraintViolations.inc({ org_id: orgId, constraint_type: constraintType });
  }

  optimizerObjectiveValue.set({ org_id: orgId }, result.objectiveValue);

  for (const crew of result.resourceUtilization.crewUtilization) {
    optimizerCrewUtilization.set(
      { org_id: orgId, crew_member: crew.crewMember },
      crew.utilizationRate
    );
  }

  const partsBudgetUtilization =
    result.resourceUtilization.partsUsedBudget > 0 && result.objectiveValue > 0
      ? Math.min((result.resourceUtilization.partsUsedBudget / result.objectiveValue) * 100, 100)
      : 0;
  optimizerPartsBudgetUtilization.set({ org_id: orgId }, partsBudgetUtilization);
}

export function recordEmptyRun(orgId: string, duration: number): void {
  optimizerRunDuration.observe({ org_id: orgId, feasible: "true" }, duration);
  optimizerRunsTotal.inc({ org_id: orgId, status: "success", feasible: "true" });
}

export function recordErrorRun(orgId: string, duration: number): void {
  optimizerRunDuration.observe({ org_id: orgId, feasible: "false" }, duration);
  optimizerRunsTotal.inc({ org_id: orgId, status: "error", feasible: "false" });
}
