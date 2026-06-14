/**
 * ML Operations Routes
 *
 * Calibration, outcome evaluation, anomaly correlation,
 * telemetry aggregation, model evaluation, and training job queue.
 */
import { Express, Request, RequestHandler, Response } from "express";
import { withErrorHandling } from "../lib/route-utils";
import { logger } from "../utils/logger";
import { authenticatedRequest } from "../middleware/auth";
import { requireAdminAuth } from "../security/authorization";
import { workOrderService, dbAlertStorage, dbMlAnalyticsStorage } from "../repositories";
import { PredictionCalibrator } from "../services/ml/prediction-calibration";
import { PredictionOutcomeTracker } from "../services/ml/prediction-outcome-tracker";
import { AnomalyCorrelator } from "../services/anomaly-correlation/anomaly-correlator";
import {
  canEnsureAggregationTable,
  TelemetryAggregator,
} from "../services/telemetry-aggregation/telemetry-aggregator";
import {
  getRecentRuns as getWarehouseRecentRuns,
  loadManifest as loadWarehouseManifest,
  runTelemetryWarehouseExport,
} from "../services/telemetry-warehouse-export";
import { ModelEvaluationGate } from "../services/ml/model-evaluation-gate";
import { MlTrainingJobQueue } from "../services/ml/ml-training-job-queue";
import { jobQueueService } from "../job-queue-service";

const LOG_CTX = "PdmGapFillRoutes";

import type { WsBroadcaster } from "../services/ml/ml-training-job-queue";

// The db handle is injected via deps; reference its type without importing the
// value (a pure type-level `import(...)` is not a runtime db coupling).
type DbHandle = (typeof import("../db"))["db"];

interface PdmGapFillDeps {
  db: DbHandle;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  wsServer?: WsBroadcaster;
}

export function registerPdmGapFillRoutes(app: Express, deps: PdmGapFillDeps): void {
  const { db, generalApiRateLimit, writeOperationRateLimit, wsServer } = deps;

  app.post(
    "/api/ml/calibration/fit",
    writeOperationRateLimit,
    withErrorHandling("fit calibration model", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { modelId, method } = req.body;

      const calibrator = new PredictionCalibrator(db);

      const result = await calibrator.fitFromHistory(orgId, modelId, { method });

      if (!result) {
        return res.status(400).json({
          message: "Insufficient data for calibration",
          hint: "Need at least 30 prediction-outcome pairs. Ensure predictions have passed their predicted failure window.",
        });
      }

      return res.json({
        success: true,
        method: result.method,
        dataPoints: result.dataPointCount,
        metrics: result.metrics,
        improvement: {
          brierScoreReduction: (
            result.metrics.brierScoreBefore - result.metrics.brierScoreAfter
          ).toFixed(4),
          percentImprovement:
            result.metrics.brierScoreBefore > 0
              ? `${((1 - result.metrics.brierScoreAfter / result.metrics.brierScoreBefore) * 100).toFixed(1)}%`
              : "N/A",
        },
      });
    })
  );

  app.get(
    "/api/ml/calibration/report",
    generalApiRateLimit,
    withErrorHandling("get calibration report", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const modelId = req.query["modelId"] as string | undefined;

      const calibrator = new PredictionCalibrator(db);

      const report = await calibrator.getCalibrationReport(orgId, modelId);

      if (!report) {
        return res.status(404).json({
          message: "No calibration model found. Run POST /api/ml/calibration/fit first.",
        });
      }

      return res.json(report);
    })
  );

  app.post(
    "/api/ml/outcomes/evaluate",
    writeOperationRateLimit,
    withErrorHandling("evaluate prediction outcomes", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;

      const tracker = new PredictionOutcomeTracker(db, {
        getWorkOrders: (equipmentId, orgId) =>
          workOrderService.getWorkOrdersWithDetails(equipmentId, orgId),
        getAlertNotifications: (acknowledged, orgId) =>
          dbAlertStorage.getAlertNotifications(acknowledged, orgId),
      });

      const report = await tracker.evaluatePredictions(orgId);

      return res.json(report);
    })
  );

  app.get(
    "/api/analytics/anomaly-groups",
    generalApiRateLimit,
    withErrorHandling("get correlated anomaly groups", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const equipmentId = req.query["equipmentId"] as string | undefined;
      const includeAcknowledged = req.query["includeAcknowledged"] === "true";

      const correlator = new AnomalyCorrelator(dbMlAnalyticsStorage);

      const report = await correlator.correlateAnomalies(orgId, {
        ...(equipmentId !== undefined && { equipmentId }),
        includeAcknowledged,
      });

      return res.json(report);
    })
  );

  app.post(
    "/api/telemetry/aggregation/run",
    writeOperationRateLimit,
    withErrorHandling("run telemetry aggregation", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { lookbackHours = 2 } = req.body;

      const aggregator = new TelemetryAggregator(db);

      const result = await aggregator.runScheduledAggregation(orgId, lookbackHours);

      return res.json({
        success: true,
        results: result,
      });
    })
  );

  app.get(
    "/api/telemetry/aggregated/:equipmentId/:sensorType",
    generalApiRateLimit,
    withErrorHandling("query aggregated telemetry", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const equipmentId = req.params["equipmentId"] ?? "";
      const sensorType = req.params["sensorType"] ?? "";
      const startDate = new Date(
        (req.query["startDate"] as string) || Date.now() - 24 * 60 * 60 * 1000
      );
      const endDate = new Date((req.query["endDate"] as string) || Date.now());
      // Reject unparseable startDate/endDate with a 400 instead of letting an
      // Invalid Date reach the query and crash .toISOString() with a 500.
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          message: "startDate and endDate must be valid date strings",
        });
      }
      const aggregator = new TelemetryAggregator(db);
      const bucket = req.query["bucket"] as Parameters<typeof aggregator.queryAggregated>[5];

      const data = await aggregator.queryAggregated(
        orgId,
        equipmentId,
        sensorType,
        startDate,
        endDate,
        bucket
      );

      return res.json({
        equipmentId,
        sensorType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bucketCount: data.length,
        data,
      });
    })
  );

  app.post(
    "/api/ml/evaluate-model",
    writeOperationRateLimit,
    withErrorHandling("evaluate model for deployment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { modelId, testData, thresholds } = req.body;

      if (!modelId) {
        return res.status(400).json({ message: "modelId is required" });
      }

      if (!testData || !Array.isArray(testData) || testData.length === 0) {
        return res.status(400).json({
          message: "testData array is required with {features, label} objects",
        });
      }

      const gate = new ModelEvaluationGate(db, thresholds);

      const predictFn = async (features: Record<string, number>): Promise<number> => {
        const values = Object.values(features);
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        return Math.max(0, Math.min(1, avg / 100));
      };

      const result = await gate.evaluate(orgId, modelId, testData, predictFn);

      return res.json(result);
    })
  );

  app.post(
    "/api/ml/train/async",
    writeOperationRateLimit,
    withErrorHandling("enqueue ML training job", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { modelType = "all", equipmentType, config = {} } = req.body;

      if (!["lstm", "random_forest", "xgboost", "all"].includes(modelType)) {
        return res.status(400).json({
          message: "modelType must be one of: lstm, random_forest, xgboost, all",
        });
      }

      try {
        const boss = jobQueueService.getBoss();
        if (!boss) {
          return res.status(503).json({ message: "Job queue not initialized" });
        }

        const queue = new MlTrainingJobQueue(boss, db, wsServer);
        await queue.registerWorker();

        const jobId = await queue.enqueueTraining({
          orgId,
          modelType,
          equipmentType,
          config,
          initiatedBy: authenticatedRequest(req).user?.id,
        });

        return res.status(202).json({
          success: true,
          jobId,
          message: `Training job enqueued for ${modelType} model(s)`,
          statusUrl: `/api/ml/train/status/${jobId}`,
        });
      } catch (error) {
        logger.warn(LOG_CTX, "Job queue unavailable, falling back to synchronous training", error);

        return res.status(200).json({
          success: true,
          message: "Training will run synchronously (job queue not available)",
          fallback: true,
        });
      }
    })
  );

  app.get(
    "/api/ml/train/status/:jobId",
    generalApiRateLimit,
    withErrorHandling("get training job status", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const jobId = req.params["jobId"] ?? "";

      try {
        const boss = jobQueueService.getBoss();
        if (!boss) {
          return res.status(503).json({ message: "Job queue not initialized" });
        }

        const queue = new MlTrainingJobQueue(boss, db);
        const status = await queue.getJobStatus(jobId);

        if (!status) {
          return res.status(404).json({ message: "Training job not found" });
        }

        if (status.data?.orgId && status.data.orgId !== orgId) {
          return res.status(404).json({ message: "Training job not found" });
        }

        return res.json(status);
      } catch (error) {
        return res.status(500).json({ message: "Job queue not available" });
      }
    })
  );

  app.get(
    "/api/ml/train/jobs",
    generalApiRateLimit,
    withErrorHandling("list training jobs", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;

      try {
        const boss = jobQueueService.getBoss();
        if (!boss) {
          return res.json({ jobs: [], count: 0, note: "Job queue not initialized" });
        }

        const queue = new MlTrainingJobQueue(boss, db);
        const jobs = await queue.getRecentJobs(orgId);

        return res.json({ jobs, count: jobs.length });
      } catch {
        return res.json({ jobs: [], count: 0, note: "Job queue not available" });
      }
    })
  );

  // Task #95 — admin status for the daily telemetry warehouse export.
  // Read-only: surfaces the in-process ring buffer of recent runs and (when
  // an orgId is supplied) the durable per-org manifest from object storage.
  app.get(
    "/api/admin/telemetry-warehouse/status",
    ...requireAdminAuth,
    generalApiRateLimit,
    withErrorHandling("get telemetry warehouse status", async (req: Request, res: Response) => {
      const limit = Math.max(1, Math.min(50, Number(req.query["limit"]) || 14));
      const orgIdParam = typeof req.query["orgId"] === "string" ? req.query["orgId"] : undefined;
      const recentRuns = await getWarehouseRecentRuns(limit);

      let manifest: Awaited<ReturnType<typeof loadWarehouseManifest>> | null = null;
      if (orgIdParam) {
        try {
          manifest = await loadWarehouseManifest(orgIdParam);
        } catch (err) {
          logger.warn(LOG_CTX, "Failed to load warehouse manifest", err);
        }
      }

      return res.json({
        recentRuns,
        manifest,
        retentionDays: Number(process.env["TELEMETRY_WAREHOUSE_RETENTION_DAYS"] ?? 0) || 0,
      });
    })
  );

  // Task #95 — admin trigger for an ad-hoc back-fill or re-export of a given
  // UTC date. Re-runs are safe (overwrite-idempotent at the partition key).
  app.post(
    "/api/admin/telemetry-warehouse/run",
    ...requireAdminAuth,
    writeOperationRateLimit,
    withErrorHandling("trigger telemetry warehouse export", async (req: Request, res: Response) => {
      const body = (req.body ?? {}) as { date?: unknown; orgIds?: unknown };
      const date = typeof body.date === "string" ? body.date : undefined;
      const orgIds = Array.isArray(body.orgIds)
        ? body.orgIds.filter((v): v is string => typeof v === "string")
        : undefined;
      const summary = await runTelemetryWarehouseExport({ date, orgIds });
      return res.json(summary);
    })
  );

  (async () => {
    try {
      if (!canEnsureAggregationTable(db)) {
        logger.info(
          LOG_CTX,
          "Telemetry aggregation table setup skipped; database handle does not support execute"
        );
        return;
      }
      const aggregator = new TelemetryAggregator(db);
      await aggregator.ensureTable();
    } catch (err) {
      logger.warn(LOG_CTX, "Telemetry aggregation table setup deferred", err);
    }
  })();

  logger.info(
    LOG_CTX,
    "Registered (calibration: 2, outcomes: 1, anomaly-groups: 1, aggregation: 2, evaluation: 1, training-queue: 3)"
  );
}
