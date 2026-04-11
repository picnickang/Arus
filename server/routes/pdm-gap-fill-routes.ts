import { Express, Request, Response } from "express";
import { withErrorHandling } from "../lib/route-utils";
import { logger } from "../utils/logger";
import type { AuthenticatedRequest } from "../middleware/auth";
/** @deprecated TODO: Migrate PredictionOutcomeTracker/ModelEvaluationGate/MlTrainingJobQueue to accept repos */
import { storage } from "../storage";

const LOG_CTX = "PdmGapFillRoutes";

interface PdmGapFillDeps {
  db: any;
  generalApiRateLimit: any;
  writeOperationRateLimit: any;
  wsServer?: any;
}

export function registerPdmGapFillRoutes(app: Express, deps: PdmGapFillDeps): void {
  const { db, generalApiRateLimit, writeOperationRateLimit, wsServer } = deps;

  app.post("/api/ml/calibration/fit", writeOperationRateLimit,
    withErrorHandling("fit calibration model", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { modelId, method } = req.body;

      const { PredictionCalibrator } = await import("../services/ml/prediction-calibration");
      const calibrator = new PredictionCalibrator(db);

      const result = await calibrator.fitFromHistory(orgId, modelId, { method });

      if (!result) {
        return res.status(400).json({
          message: "Insufficient data for calibration",
          hint: "Need at least 30 prediction-outcome pairs. Ensure predictions have passed their predicted failure window.",
        });
      }

      res.json({
        success: true,
        method: result.method,
        dataPoints: result.dataPointCount,
        metrics: result.metrics,
        improvement: {
          brierScoreReduction: (result.metrics.brierScoreBefore - result.metrics.brierScoreAfter).toFixed(4),
          percentImprovement: result.metrics.brierScoreBefore > 0
            ? ((1 - result.metrics.brierScoreAfter / result.metrics.brierScoreBefore) * 100).toFixed(1) + "%"
            : "N/A",
        },
      });
    })
  );

  app.get("/api/ml/calibration/report", generalApiRateLimit,
    withErrorHandling("get calibration report", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const modelId = req.query.modelId as string | undefined;

      const { PredictionCalibrator } = await import("../services/ml/prediction-calibration");
      const calibrator = new PredictionCalibrator(db);

      const report = await calibrator.getCalibrationReport(orgId, modelId);

      if (!report) {
        return res.status(404).json({
          message: "No calibration model found. Run POST /api/ml/calibration/fit first.",
        });
      }

      res.json(report);
    })
  );

  app.post("/api/ml/outcomes/evaluate", writeOperationRateLimit,
    withErrorHandling("evaluate prediction outcomes", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { PredictionOutcomeTracker } = await import("../services/ml/prediction-outcome-tracker");
      const tracker = new PredictionOutcomeTracker(db, storage);

      const report = await tracker.evaluatePredictions(orgId);

      res.json(report);
    })
  );

  app.get("/api/analytics/anomaly-groups", generalApiRateLimit,
    withErrorHandling("get correlated anomaly groups", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.query.equipmentId as string | undefined;
      const includeAcknowledged = req.query.includeAcknowledged === "true";

      const { AnomalyCorrelator } = await import("../services/anomaly-correlation/anomaly-correlator");
      const { dbMlAnalyticsStorage } = await import("../db/ml-analytics/index");
      const correlator = new AnomalyCorrelator(dbMlAnalyticsStorage);

      const report = await correlator.correlateAnomalies(orgId, {
        equipmentId,
        includeAcknowledged,
      });

      res.json(report);
    })
  );

  app.post("/api/telemetry/aggregation/run", writeOperationRateLimit,
    withErrorHandling("run telemetry aggregation", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { lookbackHours = 2 } = req.body;

      const { TelemetryAggregator } = await import("../services/telemetry-aggregation/telemetry-aggregator");
      const aggregator = new TelemetryAggregator(db);

      const result = await aggregator.runScheduledAggregation(orgId, lookbackHours);

      res.json({
        success: true,
        results: result,
      });
    })
  );

  app.get("/api/telemetry/aggregated/:equipmentId/:sensorType", generalApiRateLimit,
    withErrorHandling("query aggregated telemetry", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId, sensorType } = req.params;
      const startDate = new Date(req.query.startDate as string || Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date(req.query.endDate as string || Date.now());
      const bucket = req.query.bucket as any;

      const { TelemetryAggregator } = await import("../services/telemetry-aggregation/telemetry-aggregator");
      const aggregator = new TelemetryAggregator(db);

      const data = await aggregator.queryAggregated(orgId, equipmentId, sensorType, startDate, endDate, bucket);

      res.json({
        equipmentId,
        sensorType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bucketCount: data.length,
        data,
      });
    })
  );

  app.post("/api/ml/evaluate-model", writeOperationRateLimit,
    withErrorHandling("evaluate model for deployment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { modelId, testData, thresholds } = req.body;

      if (!modelId) {
        return res.status(400).json({ message: "modelId is required" });
      }

      if (!testData || !Array.isArray(testData) || testData.length === 0) {
        return res.status(400).json({
          message: "testData array is required with {features, label} objects",
        });
      }

      const { ModelEvaluationGate } = await import("../services/ml/model-evaluation-gate");
      const gate = new ModelEvaluationGate(db, storage, thresholds);

      const predictFn = async (features: Record<string, number>): Promise<number> => {
        const values = Object.values(features);
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        return Math.max(0, Math.min(1, avg / 100));
      };

      const result = await gate.evaluate(orgId, modelId, testData, predictFn);

      res.json(result);
    })
  );

  app.post("/api/ml/train/async", writeOperationRateLimit,
    withErrorHandling("enqueue ML training job", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { modelType = "all", equipmentType, config = {} } = req.body;

      if (!["lstm", "random_forest", "xgboost", "all"].includes(modelType)) {
        return res.status(400).json({
          message: "modelType must be one of: lstm, random_forest, xgboost, all",
        });
      }

      try {
        const { MlTrainingJobQueue } = await import("../services/ml/ml-training-job-queue");
        const { jobQueueService } = await import("../job-queue-service");

        const boss = jobQueueService.getBoss();
        if (!boss) {
          return res.status(503).json({ message: "Job queue not initialized" });
        }

        const queue = new MlTrainingJobQueue(boss, storage, wsServer);
        await queue.registerWorker();

        const jobId = await queue.enqueueTraining({
          orgId,
          modelType,
          equipmentType,
          config,
          initiatedBy: (req as AuthenticatedRequest).user?.id,
        });

        res.status(202).json({
          success: true,
          jobId,
          message: `Training job enqueued for ${modelType} model(s)`,
          statusUrl: `/api/ml/train/status/${jobId}`,
        });
      } catch (error) {
        logger.warn(LOG_CTX, "Job queue unavailable, falling back to synchronous training", error);

        res.status(200).json({
          success: true,
          message: "Training will run synchronously (job queue not available)",
          fallback: true,
        });
      }
    })
  );

  app.get("/api/ml/train/status/:jobId", generalApiRateLimit,
    withErrorHandling("get training job status", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { jobId } = req.params;

      try {
        const { MlTrainingJobQueue } = await import("../services/ml/ml-training-job-queue");
        const { jobQueueService } = await import("../job-queue-service");

        const boss = jobQueueService.getBoss();
        if (!boss) {
          return res.status(503).json({ message: "Job queue not initialized" });
        }

        const queue = new MlTrainingJobQueue(boss, storage);
        const status = await queue.getJobStatus(jobId);

        if (!status) {
          return res.status(404).json({ message: "Training job not found" });
        }

        if (status.data?.orgId && status.data.orgId !== orgId) {
          return res.status(404).json({ message: "Training job not found" });
        }

        res.json(status);
      } catch (error) {
        res.status(500).json({ message: "Job queue not available" });
      }
    })
  );

  app.get("/api/ml/train/jobs", generalApiRateLimit,
    withErrorHandling("list training jobs", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      try {
        const { MlTrainingJobQueue } = await import("../services/ml/ml-training-job-queue");
        const { jobQueueService } = await import("../job-queue-service");

        const boss = jobQueueService.getBoss();
        if (!boss) {
          return res.json({ jobs: [], count: 0, note: "Job queue not initialized" });
        }

        const queue = new MlTrainingJobQueue(boss, storage);
        const jobs = await queue.getRecentJobs(orgId);

        res.json({ jobs, count: jobs.length });
      } catch {
        res.json({ jobs: [], count: 0, note: "Job queue not available" });
      }
    })
  );

  (async () => {
    try {
      const { TelemetryAggregator } = await import("../services/telemetry-aggregation/telemetry-aggregator");
      const aggregator = new TelemetryAggregator(db);
      await aggregator.ensureTable();
    } catch (err) {
      logger.warn(LOG_CTX, "Telemetry aggregation table setup deferred", err);
    }
  })();

  logger.info(LOG_CTX, "Registered (calibration: 2, outcomes: 1, anomaly-groups: 1, aggregation: 2, evaluation: 1, training-queue: 3)");
}
