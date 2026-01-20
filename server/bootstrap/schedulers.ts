/**
 * Scheduler Initialization
 * Insights, predictive maintenance, ML retraining, cleanup schedules
 */

export async function initializeSchedulers(isEmbedded: boolean): Promise<void> {
  const enableSchedulers = process.env.ENABLE_SCHEDULERS !== "false" && !isEmbedded;

  if (!enableSchedulers) {
    console.log("ℹ️  Schedulers disabled (embedded/standalone mode)");
    return;
  }

  console.log("→ Setting up schedulers...");

  const {
    setupInsightsSchedule,
    setupPredictiveMaintenanceSchedule,
    setupMLRetrainingSchedule,
  } = await import("../insights-scheduler");
  const { setupVesselSchedules } = await import("../vessel-scheduler");
  const { setupOptimizationCleanupSchedule } = await import("../optimization-cleanup-scheduler");
  const { setupMaterializedViewRefresh } = await import("../materialized-view-scheduler");

  setupInsightsSchedule();
  setupPredictiveMaintenanceSchedule();
  setupMLRetrainingSchedule();
  setupVesselSchedules();
  setupOptimizationCleanupSchedule();
  setupMaterializedViewRefresh();

  const { dataReconciliationService } = await import("../services/data-reconciliation.js");
  dataReconciliationService.startScheduledReconciliation(60);
  console.log("✅ Data reconciliation schedule configured (every 60 minutes)");

  console.log("✓ Schedulers configured");
}

export async function initializeBackgroundJobs(isEmbedded: boolean): Promise<void> {
  const enableBackgroundJobs = process.env.ENABLE_BACKGROUND_JOBS !== "false" && !isEmbedded;

  if (isEmbedded) {
    console.log("ℹ️  Embedded mode: Background jobs and schedulers disabled for stability");
  }

  if (!enableBackgroundJobs) {
    console.log("ℹ️  Background jobs disabled (embedded/standalone mode)");
    return;
  }

  console.log("→ Starting background jobs...");
  const { startBackgroundJobs } = await import("../job-processors");
  startBackgroundJobs();
  console.log("✓ Background jobs started");
}
