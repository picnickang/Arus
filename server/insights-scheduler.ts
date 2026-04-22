// Stub file - insights scheduler consolidated
export function startInsightsScheduler(): void {
  console.log("[Insights Scheduler] Scheduler startup skipped - using on-demand generation");
}

export function stopInsightsScheduler(): void {
  // No-op
}

export function setupInsightsSchedule(): void {
  console.log("[Insights Scheduler] Insights schedule configured (stub)");
}

export function setupPredictiveMaintenanceSchedule(): void {
  console.log("[Insights Scheduler] Predictive maintenance schedule configured (stub)");
}

export function setupMLRetrainingSchedule(): void {
  console.log("[Insights Scheduler] ML retraining schedule configured (stub)");
}

export async function triggerInsightsGeneration(_orgId?: string): Promise<{
  success: boolean;
  message: string;
  jobId?: string;
}> {
  return {
    success: true,
    message: "Insights generation triggered (stub mode)",
    jobId: "stub-job-id",
  };
}

export function getInsightsJobStats(): {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  lastRun: Date | null;
} {
  return {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    lastRun: null,
  };
}

export const insightsScheduler = {
  start: startInsightsScheduler,
  stop: stopInsightsScheduler,
  trigger: triggerInsightsGeneration,
  stats: getInsightsJobStats,
  setupInsights: setupInsightsSchedule,
  setupPredictive: setupPredictiveMaintenanceSchedule,
  setupML: setupMLRetrainingSchedule,
};
