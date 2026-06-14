import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Bootstrap:Schedulers");
/**
 * Scheduler Initialization
 * Insights, predictive maintenance, ML retraining, cleanup schedules
 */

export async function initializeSchedulers(isEmbedded: boolean): Promise<void> {
  const enableSchedulers = process.env["ENABLE_SCHEDULERS"] !== "false" && !isEmbedded;

  if (!enableSchedulers) {
    logger.info("ℹ️  Schedulers disabled (embedded/standalone mode)");
    return;
  }

  logger.info("→ Setting up schedulers...");

  // Dynamic imports below are intentional: in embedded / standalone /
  // ENABLE_SCHEDULERS=false modes we return above before this point, so
  // these scheduler modules (and their heavy transitive deps — twin
  // services, ML retraining, materialized-view refresh) must NOT be
  // pulled into the module graph at boot. Do not convert to static.
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
  logger.info("✅ Data reconciliation schedule configured (every 60 minutes)");

  setupTwinRefreshSchedule();
  setupPredictionExpirySchedule();
  setupEmailDigestSchedule();

  logger.info("✓ Schedulers configured");
}

/**
 * Periodically drain the notification_queue digest items.
 *
 * processDigestQueue() sends any pending rows whose scheduledFor has elapsed
 * (digest-mode compliance notifications are queued for the next 08:00). Without
 * this poller those rows accumulate indefinitely — nothing else triggers them
 * outside the manual POST /api/notifications/email/process-digest endpoint.
 *
 * CLOUD-only: initializeSchedulers early-returns in embedded/VESSEL mode, and
 * notification_queue is a cloud-only table. Honors DISABLE_EMAIL_WORKER (the
 * shared "no email background processing" switch) plus a dedicated
 * DISABLE_EMAIL_DIGEST_SCHEDULER for operators who want the purchasing email
 * worker on but the digest poller off.
 */
export function setupEmailDigestSchedule(): void {
  if (
    process.env["DISABLE_EMAIL_WORKER"] === "true" ||
    process.env["DISABLE_EMAIL_DIGEST_SCHEDULER"] === "true"
  ) {
    logger.info("ℹ️  Email digest scheduler disabled");
    return;
  }

  const INTERVAL_MS = Number.parseInt(
    process.env["EMAIL_DIGEST_INTERVAL_MS"] ?? `${15 * 60 * 1000}`,
    10
  );

  setInterval(async () => {
    try {
      const { emailNotificationService } = await import(
        "../services/email-notification-service.js"
      );
      const processed = await emailNotificationService.processDigestQueue();
      if (processed > 0) {
        logger.info(`[EmailDigest] Processed ${processed} digest item(s)`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[EmailDigest] Scheduled digest run failed:", undefined, message);
    }
  }, INTERVAL_MS);

  logger.info(`✅ Email digest schedule configured (every ${INTERVAL_MS / 60000} minutes)`);
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
        logger.info(`[TwinRefresh] Refreshed ${result.refreshed}, failed ${result.failed}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[TwinRefresh] Scheduled refresh failed:", undefined, message);
    }
  }, INTERVAL_MS);
  logger.info("✅ Twin refresh schedule configured (every 5 minutes)");
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
        logger.info(`[PredictionExpiry] Expired ${result.expiredCount} stale predictions`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[PredictionExpiry] Scheduled expiry failed:", undefined, message);
    }
  }, INTERVAL_MS);
  logger.info("✅ Prediction expiry schedule configured (every 15 minutes)");
}

export async function initializeBackgroundJobs(isEmbedded: boolean): Promise<void> {
  const enableBackgroundJobs = process.env["ENABLE_BACKGROUND_JOBS"] !== "false" && !isEmbedded;

  if (isEmbedded) {
    logger.info("ℹ️  Embedded mode: Background jobs and schedulers disabled for stability");
  }

  if (!enableBackgroundJobs) {
    logger.info("ℹ️  Background jobs disabled (embedded/standalone mode)");
    return;
  }

  logger.info("→ Starting background jobs...");
  const { startBackgroundJobs } = await import("../job-processors");
  await startBackgroundJobs();
  logger.info("✓ Background jobs started");
}
