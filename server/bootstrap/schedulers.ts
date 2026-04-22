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

  const { setupInsightsSchedule, setupPredictiveMaintenanceSchedule, setupMLRetrainingSchedule } =
    await import("../insights-scheduler");
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

  setupTwinRefreshSchedule();
  setupPredictionExpirySchedule();

  console.log("✓ Schedulers configured");
}

function setupTwinRefreshSchedule(): void {
  const INTERVAL_MS = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      const { DEFAULT_ORG_ID } = await import("../../shared/config/tenant");
      const { TwinUpdateService } = await import(
        "../domains/pdm-platform/twin-updates/twin-update.service"
      );
      const { TwinFreshnessAdapter } = await import("../domains/pdm-platform/twin-updates/adapter");
      const { TwinDefinitionAdapter } = await import(
        "../domains/pdm-platform/digital-twin/twin-definition/adapter"
      );
      const { TwinStateAdapter } = await import(
        "../domains/pdm-platform/digital-twin/twin-state/adapter"
      );
      const { TwinStateService } = await import(
        "../domains/pdm-platform/digital-twin/twin-state/twin-state.service"
      );
      const { ResidualAnalysisService } = await import(
        "../domains/pdm-platform/digital-twin/residual-analysis/residual-analysis.service"
      );
      const { TelemetryAdapter } = await import(
        "../domains/pdm-platform/feature-store/telemetry-adapter"
      );

      const defAdapter = new TwinDefinitionAdapter();
      const stateAdapter = new TwinStateAdapter();
      const telemetryAdapter = new TelemetryAdapter();
      const stateService = new TwinStateService(stateAdapter, defAdapter, telemetryAdapter);
      const residualService = new ResidualAnalysisService();
      const freshnessAdapter = new TwinFreshnessAdapter();
      const updateService = new TwinUpdateService(freshnessAdapter, stateService, residualService);

      const result = await updateService.refreshAllActiveTwins(DEFAULT_ORG_ID);
      if (result.refreshed > 0 || result.failed > 0) {
        console.log(`[TwinRefresh] Refreshed ${result.refreshed}, failed ${result.failed}`);
      }
    } catch (error: any) {
      console.error("[TwinRefresh] Scheduled refresh failed:", error.message);
    }
  }, INTERVAL_MS);
  console.log("✅ Twin refresh schedule configured (every 5 minutes)");
}

function setupPredictionExpirySchedule(): void {
  const INTERVAL_MS = 15 * 60 * 1000;
  setInterval(async () => {
    try {
      const { DEFAULT_ORG_ID } = await import("../../shared/config/tenant");
      const { PredictionGovernanceService } = await import(
        "../domains/pdm-platform/prediction-governance/prediction-governance.service"
      );
      const { PredictionGovernanceAdapter } = await import(
        "../domains/pdm-platform/prediction-governance/adapter"
      );
      const adapter = new PredictionGovernanceAdapter();
      const service = new PredictionGovernanceService(adapter);
      const result = await service.expireStale(DEFAULT_ORG_ID);
      if (result.expiredCount > 0) {
        console.log(`[PredictionExpiry] Expired ${result.expiredCount} stale predictions`);
      }
    } catch (error: any) {
      console.error("[PredictionExpiry] Scheduled expiry failed:", error.message);
    }
  }, INTERVAL_MS);
  console.log("✅ Prediction expiry schedule configured (every 15 minutes)");
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
