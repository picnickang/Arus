import type { Express, Request, Response } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import { dbMlAnalyticsStorage } from "../../db/ml-analytics/index.js";

interface AuthenticatedRequest extends Request {
  orgId?: string;
}

interface MlPipelineRoutesConfig {
  generalApiRateLimit: RateLimitRequestHandler;
}

export function registerMlPipelineRoutes(app: Express, config: MlPipelineRoutesConfig): void {
  const { generalApiRateLimit } = config;

  logger.info("MLPipelineRoutes", "Registering ML pipeline API endpoints");

  // ============================================================================
  // Acoustic Monitoring Routes
  // ============================================================================

  app.post(
    "/api/acoustic/analyze",
    generalApiRateLimit,
    withErrorHandling("analyze acoustic data", async (req: Request, res: Response) => {
      const { acousticData, sampleRate, equipmentType, rpm } = req.body;

      if (!Array.isArray(acousticData) || typeof sampleRate !== "number") {
        return res.status(400).json({
          error: "Invalid input. Requires acousticData (array) and sampleRate (number)",
        });
      }

      const { performAcousticAnalysis } = await import("../../acoustic-monitoring");
      const analysis = performAcousticAnalysis(acousticData, sampleRate, equipmentType, rpm);

      res.json(analysis);
    })
  );

  app.post(
    "/api/acoustic/features",
    generalApiRateLimit,
    withErrorHandling("extract acoustic features", async (req: Request, res: Response) => {
      const { acousticData, sampleRate, rpm } = req.body;

      if (!Array.isArray(acousticData) || typeof sampleRate !== "number") {
        return res.status(400).json({
          error: "Invalid input. Requires acousticData (array) and sampleRate (number)",
        });
      }

      const { analyzeAcoustic } = await import("../../acoustic-monitoring");
      const features = analyzeAcoustic(acousticData, sampleRate, rpm);

      res.json(features);
    })
  );

  // ============================================================================
  // ML Training Routes
  // ============================================================================

  app.post(
    "/api/ml/train/lstm",
    generalApiRateLimit,
    withErrorHandling("train LSTM model", async (req: AuthenticatedRequest, res: Response) => {
      const { orgId = req.orgId!, equipmentType, lstmConfig } = req.body;

      const { trainLSTMForFailurePrediction } = await import("../../ml-training-pipeline");

      const config = {
        orgId,
        equipmentType,
        modelType: "lstm" as const,
        targetMetric: "failure_prediction" as const,
        lstmConfig: lstmConfig || {
          sequenceLength: 7,
          featureCount: 0,
          lstmUnits: 32,
          dropoutRate: 0.2,
          learningRate: 0.001,
          epochs: 20,
          batchSize: 64,
          useEarlyStopping: true,
          earlyStoppingPatience: 5,
          verbose: true,
        },
      };

      const result = await trainLSTMForFailurePrediction(config);
      res.json(result);
    })
  );

  app.post(
    "/api/ml/train/random-forest",
    generalApiRateLimit,
    withErrorHandling(
      "train Random Forest model",
      async (req: AuthenticatedRequest, res: Response) => {
        const { orgId = req.orgId!, equipmentType, rfConfig } = req.body;

        const { trainRFForHealthClassification } = await import("../../ml-training-pipeline");

        const config = {
          orgId,
          equipmentType,
          modelType: "random_forest" as const,
          targetMetric: "health_classification" as const,
          rfConfig: rfConfig || {
            numTrees: 50,
            maxDepth: 10,
            minSamplesSplit: 5,
            maxFeatures: 8,
            bootstrapSampleRatio: 0.8,
          },
        };

        const result = await trainRFForHealthClassification(config);
        res.json(result);
      }
    )
  );

  app.post(
    "/api/ml/train/xgboost",
    generalApiRateLimit,
    withErrorHandling("train XGBoost model", async (req: AuthenticatedRequest, res: Response) => {
      const { orgId = req.orgId!, equipmentType, xgboostConfig } = req.body;

      const { trainXGBoostForHealthClassification } = await import("../../ml-training-pipeline");

      const config = {
        orgId,
        equipmentType,
        modelType: "xgboost" as const,
        targetMetric: "health_classification" as const,
        xgboostConfig: xgboostConfig || {
          maxDepth: 6,
          learningRate: 0.1,
          numRounds: 100,
          objective: "binary:logistic",
          eval_metric: "logloss",
        },
      };

      const result = await trainXGBoostForHealthClassification(config);
      res.json(result);
    })
  );

  app.post(
    "/api/ml/train/all",
    generalApiRateLimit,
    withErrorHandling(
      "batch train all models",
      async (req: AuthenticatedRequest, res: Response) => {
        const { orgId = req.orgId! } = req.body;

        const { retrainAllModels } = await import("../../ml-training-pipeline");
        const results = await retrainAllModels(orgId);

        res.json({
          message: `Successfully trained ${results.length} models`,
          results,
        });
      }
    )
  );

  // ============================================================================
  // ML Prediction Routes
  // ============================================================================

  /**
   * POST /api/ml/predict/failure - Production-ready equipment failure prediction
   *
   * Features:
   * - Circuit breaker protection (prevents cascading failures)
   * - ML observability logging (success/failure metrics, latency tracking)
   * - Multiple prediction methods with controlled rollout via feature flags
   * - Automatic prediction storage in database
   *
   * Method Options:
   * - 'ensemble' (recommended): 90-95% accuracy target, combines LSTM + XGBoost + Random Forest
   * - 'lstm': Time-series neural network for temporal patterns
   * - 'random_forest': Classification model for health status
   * - 'hybrid' (default): Weighted averaging of all available models
   */
  app.post(
    "/api/ml/predict/failure",
    generalApiRateLimit,
    withErrorHandling(
      "predict equipment failure",
      async (req: AuthenticatedRequest, res: Response) => {
        const { equipmentId, orgId = req.orgId!, method = "hybrid" } = req.body;

        if (!equipmentId) {
          return res.status(400).json({ error: "equipmentId is required" });
        }

        const {
          predictFailureWithLSTM,
          predictHealthWithRandomForest,
          predictWithHybridModel,
          predictWithEnsemble,
          storePrediction,
        } = await import("../../ml-prediction-service");

        let prediction = null;

        if (method === "lstm") {
          prediction = await predictFailureWithLSTM(equipmentId, orgId);
        } else if (method === "random_forest") {
          prediction = await predictHealthWithRandomForest(equipmentId, orgId);
        } else if (method === "ensemble") {
          prediction = await predictWithEnsemble(equipmentId, orgId);
        } else {
          prediction = await predictWithHybridModel(equipmentId, orgId);
        }

        if (!prediction) {
          return res.status(404).json({
            error: "No ML models available for prediction",
            hint: "Train models first using /api/ml/train endpoints",
          });
        }

        await storePrediction(equipmentId, orgId, prediction);
        res.json(prediction);
      }
    )
  );

  // ============================================================================
  // ML Retraining & Training Window Routes
  // ============================================================================

  app.get(
    "/api/ml/retraining-triggers",
    generalApiRateLimit,
    withErrorHandling(
      "evaluate retraining triggers",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;

        const { evaluateRetrainingTriggers } = await import("../../ml-retraining-service");
        const triggers = await evaluateRetrainingTriggers();

        res.json(triggers);
      }
    )
  );

  app.get(
    "/api/ml/training-window/:equipmentType?",
    generalApiRateLimit,
    withErrorHandling(
      "determine training window",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const equipmentType = req.params.equipmentType;

        const { determineOptimalTrainingWindow } = await import("../../adaptive-training-window");
        const windowConfig = await determineOptimalTrainingWindow(orgId, equipmentType);

        res.json(windowConfig);
      }
    )
  );

  // ============================================================================
  // ML Health & Metrics Routes
  // ============================================================================

  app.get(
    "/api/ml/health",
    withErrorHandling("check ML health", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;

      const {
        lstmCircuitBreaker,
        randomForestCircuitBreaker,
        xgboostCircuitBreaker,
        ensembleCircuitBreaker,
      } = await import("../../ml-circuit-breaker");

      const { getModelRegistry } = await import("../../ml-model-registry");
      const registry = getModelRegistry();

      const circuitBreakers = {
        lstm: {
          state: lstmCircuitBreaker.state,
          failures: lstmCircuitBreaker.failureCount,
          lastFailure: lstmCircuitBreaker.lastFailureTime,
        },
        randomForest: {
          state: randomForestCircuitBreaker.state,
          failures: randomForestCircuitBreaker.failureCount,
          lastFailure: randomForestCircuitBreaker.lastFailureTime,
        },
        xgboost: {
          state: xgboostCircuitBreaker.state,
          failures: xgboostCircuitBreaker.failureCount,
          lastFailure: xgboostCircuitBreaker.lastFailureTime,
        },
        ensemble: {
          state: ensembleCircuitBreaker.state,
          failures: ensembleCircuitBreaker.failureCount,
          lastFailure: ensembleCircuitBreaker.lastFailureTime,
        },
      };

      const cacheStats = registry.getCacheStats();
      const cachedModels = registry.listCachedModels();

      const mlModels = await dbMlAnalyticsStorage.getMlModels(orgId);
      const modelCounts = {
        lstm: mlModels.filter((m) => m.modelType === "lstm").length,
        randomForest: mlModels.filter((m) => m.modelType === "random_forest").length,
        xgboost: mlModels.filter((m) => m.modelType === "xgboost").length,
      };

      const allCircuitsClosed = Object.values(circuitBreakers).every(
        (cb) => cb.state.toUpperCase() === "CLOSED"
      );
      const hasModels = mlModels.length > 0;
      const status = allCircuitsClosed && hasModels ? "healthy" : "degraded";

      res.json({
        status,
        timestamp: new Date().toISOString(),
        circuitBreakers,
        modelRegistry: {
          cacheStats,
          cachedModelsCount: cachedModels.length,
        },
        availableModels: modelCounts,
        totalModels: mlModels.length,
      });
    })
  );

  app.get(
    "/api/ml/metrics",
    withErrorHandling("retrieve ML metrics", async (req: Request, res: Response) => {
      const { getMetrics, getMetricsContentType } = await import("../../ml-prometheus-metrics");
      const metrics = await getMetrics();

      res.set("Content-Type", getMetricsContentType());
      res.send(metrics);
    })
  );

  // ============================================================================
  // RUL (Remaining Useful Life) Analysis Routes
  // ============================================================================

  app.get(
    "/api/rul/models",
    generalApiRateLimit,
    withErrorHandling("get RUL models", async (req: AuthenticatedRequest, res: Response) => {
      const { componentClass, orgId = req.orgId! } = req.query;
      const models = await dbMlAnalyticsStorage.getRulModels(orgId as string);
      res.json(models);
    })
  );

  app.post(
    "/api/rul/fit",
    generalApiRateLimit,
    withErrorHandling("fit RUL model", async (req: AuthenticatedRequest, res: Response) => {
      const { modelId, componentClass, failureTimes } = req.body;
      const orgId = req.orgId!;

      const { fitWeibullComprehensive } = await import("../../rul");
      const fitResult = fitWeibullComprehensive(failureTimes, modelId, componentClass);

      const model = await dbMlAnalyticsStorage.createRulModel({
        orgId,
        modelId: fitResult.modelId,
        componentClass: fitResult.componentClass,
        shapeK: fitResult.shapeK,
        scaleLambda: fitResult.scaleLambda,
        confidenceLo: fitResult.confidenceInterval.lower,
        confidenceHi: fitResult.confidenceInterval.upper,
        trainingData: fitResult.trainingData,
        validationMetrics: fitResult.validationMetrics,
        isActive: true,
        createdAt: new Date(),
      });

      res.json({ fitResult, storedModel: model });
    })
  );

  app.post(
    "/api/rul/predict",
    generalApiRateLimit,
    withErrorHandling("predict RUL", async (req: AuthenticatedRequest, res: Response) => {
      const { modelId, currentAge, quantile = 0.5 } = req.body;
      const orgId = req.orgId!;

      const model = await dbMlAnalyticsStorage.getRulModel(modelId, orgId);
      if (!model) {
        return sendNotFound(res, "RUL model");
      }

      const { predictRUL } = await import("../../rul");
      const prediction = predictRUL(currentAge, model.shapeK, model.scaleLambda, quantile);

      res.json({
        prediction,
        model: { modelId: model.modelId, componentClass: model.componentClass },
      });
    })
  );

  logger.info(
    "MLPipelineRoutes",
    "Registered (acoustic: 2, ml-training: 4, ml-prediction: 1, ml-health: 4, rul: 3)"
  );
}
