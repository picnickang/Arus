/**
 * ML Prediction Functions (LSTM, Random Forest, XGBoost, Hybrid, Ensemble)
 */
import type { TimeSeriesFeatures, ClassificationFeatures } from "../ml-training-data.js";
import { preprocessTelemetryForTraining } from "../ml-data-preprocessing.js";
import { getBestModel } from "../ml-training-pipeline.js";
import { predictWithRandomForest } from "../ml-random-forest.js";
import {
  lstmCircuitBreaker,
  randomForestCircuitBreaker,
  xgboostCircuitBreaker,
  ensembleCircuitBreaker,
} from "../ml-circuit-breaker.js";
import { bucketTelemetry, getLastNBuckets } from "../ml-time-bucketing.js";
import { loadPreprocessingParams } from "../ml-preprocessing-params.js";
import { logger } from "../utils/logger.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbTelemetryStorage } from "../db/telemetry/index.js";
import { getModel, withProtection } from "./model-loader.js";
import {
  sanitizeTelemetry,
  calculateStats,
  generateRecommendations,
  DEFAULT_LOOKBACK_DAYS,
  type MLPredictionResult,
} from "./types.js";

export async function predictFailureWithLSTM(
  equipmentId: string,
  orgId: string
): Promise<MLPredictionResult | null> {
  return withProtection("ml_lstm", equipmentId, orgId, lstmCircuitBreaker, async () => {
    const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
    if (!equipment) {
      return null;
    }
    const { getBestModel } = await import("../ml-training-pipeline.js");
    const modelPath = await getBestModel(orgId, equipment.type, "lstm");
    if (!modelPath) {
      return null;
    }
    const model = await getModel(modelPath, "lstm");
    const endDate = new Date();
    const lookbackDays = (equipment as { lookbackDays?: number }).lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const rawTelemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
      equipmentId,
      startDate,
      endDate,
      orgId
    );
    const sanitized = sanitizeTelemetry(rawTelemetry);
    const telemetry = preprocessTelemetryForTraining(sanitized);
    const bucketed = bucketTelemetry(telemetry, { bucketSizeMs: 1000, aggregationMethod: "mean" });
    if (bucketed.length >= model.config.sequenceLength) {
      const sequenceBuckets = getLastNBuckets(bucketed, model.config.sequenceLength);
      const timeSeriesFeatures: TimeSeriesFeatures[] = sequenceBuckets.map((bucket): any => {
        const features: Record<string, number> = {};
        for (const [sensorType, value] of bucket.sensors.entries()) {
          features[sensorType] = value;
        }
        return {
          equipmentId,
          timestamp: new Date(bucket.timestamp),
          features,
          normalizedFeatures: {},
          label: 0,
        };
      });
      const preprocParams = await loadPreprocessingParams(modelPath);
      const { predictWithLSTM } = await import("../ml-lstm-model.js");
      const prediction = await predictWithLSTM(model, timeSeriesFeatures, preprocParams);
      const predictedFailureDate =
        prediction.daysToFailure === null
          ? null
          : new Date(Date.now() + prediction.daysToFailure * 24 * 60 * 60 * 1000);
      return {
        method: "ml_lstm",
        failureProbability: prediction.failureProbability,
        confidence: prediction.confidence,
        predictedFailureDate,
        remainingDays: prediction.daysToFailure || 30,
        healthScore: Math.round((1 - prediction.failureProbability) * 100),
        recommendations: generateRecommendations(prediction.failureProbability, "lstm"),
      };
    }
    return null;
  });
}

export async function predictHealthWithRandomForest(
  equipmentId: string,
  orgId: string
): Promise<MLPredictionResult | null> {
  return withProtection<any>(
    "ml_random_forest",
    equipmentId,
    orgId,
    randomForestCircuitBreaker,
    async () => {
      const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
      if (!equipment) {
        return null;
      }
      const modelPath = await getBestModel(orgId, equipment.type, "random_forest");
      if (!modelPath) {
        return null;
      }
      const model = await getModel(modelPath, "random_forest");
      const endDate = new Date();
      const lookbackDays = (equipment as { lookbackDays?: number }).lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
      const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
      const rawTelemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
        equipmentId,
        startDate,
        endDate,
        orgId
      );
      const sanitized = sanitizeTelemetry(rawTelemetry);
      const telemetry = preprocessTelemetryForTraining(sanitized);
      const tempStats = calculateStats(
        telemetry.filter((t) => t.sensorType.toLowerCase().includes("temp")).map((t) => t.value)
      );
      const vibStats = calculateStats(
        telemetry.filter((t) => t.sensorType.toLowerCase().includes("vib")).map((t) => t.value)
      );
      const pressureStats = calculateStats(
        telemetry.filter((t) => t.sensorType.toLowerCase().includes("pressure")).map((t) => t.value)
      );
      const features: ClassificationFeatures = ({
        equipmentId,
        equipmentType: equipment.type,
        features: {
          avgTemperature: tempStats.avg,
          maxTemperature: tempStats.max,
          stdTemperature: tempStats.std,
          avgVibration: vibStats.avg,
          maxVibration: vibStats.max,
          stdVibration: vibStats.std,
          avgPressure: pressureStats.avg,
          minPressure: pressureStats.min,
          operatingHours: 0,
          cycleCount: 0,
          maintenanceAge: 30,
          failureHistory: 0,
        },
        label: "healthy",
        failureRisk: 0,
      } as object as ClassificationFeatures);
      const prediction = predictWithRandomForest(model, features);
      const failureProbability = prediction.failureRisk;
      let remainingDays = 90;
      if (prediction.prediction === "critical") {
        remainingDays = 7;
      } else if (prediction.prediction === "warning") {
        remainingDays = 30;
      }
      const predictedFailureDate =
        prediction.prediction !== "healthy"
          ? new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000)
          : null;
      const recommendations =
        prediction.prediction === "critical"
          ? [
              "Critical health status detected",
              "Schedule immediate maintenance",
              `Top factors: ${prediction.contributingFeatures
                .slice(0, 2)
                .map((f) => f.feature)
                .join(", ")}`,
            ]
          : prediction.prediction === "warning"
            ? [
                "Warning: Equipment health degrading",
                "Schedule preventive maintenance",
                `Monitor: ${prediction.contributingFeatures
                  .slice(0, 2)
                  .map((f) => f.feature)
                  .join(", ")}`,
              ]
            : ["Equipment health is good", "Continue routine monitoring"];
      return {
        method: "ml_rf",
        failureProbability,
        confidence: prediction.confidence,
        predictedFailureDate,
        remainingDays,
        healthScore: Math.round((1 - failureProbability) * 100),
        recommendations,
      };
    }
  );
}

export async function predictHealthWithXGBoost(
  equipmentId: string,
  orgId: string
): Promise<MLPredictionResult | null> {
  return withProtection("ml_xgboost", equipmentId, orgId, xgboostCircuitBreaker, async () => {
    const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
    if (!equipment) {
      return null;
    }
    const modelPath = await getBestModel(orgId, equipment.type, "xgboost");
    if (!modelPath) {
      return predictHealthWithRandomForest(equipmentId, orgId);
    }
    const { loadXGBoostModel } = await import("../ml-xgboost-model.js");
    const model = await loadXGBoostModel(modelPath);
    const endDate = new Date();
    const lookbackDays = (equipment as { lookbackDays?: number }).lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const rawTelemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
      equipmentId,
      startDate,
      endDate,
      orgId
    );
    const sanitized = sanitizeTelemetry(rawTelemetry);
    const telemetry = preprocessTelemetryForTraining(sanitized);
    const tempStats = calculateStats(
      telemetry.filter((t) => t.sensorType.toLowerCase().includes("temp")).map((t) => t.value)
    );
    const vibStats = calculateStats(
      telemetry.filter((t) => t.sensorType.toLowerCase().includes("vib")).map((t) => t.value)
    );
    const pressureStats = calculateStats(
      telemetry.filter((t) => t.sensorType.toLowerCase().includes("pressure")).map((t) => t.value)
    );
    const features = {
      avgTemperature: tempStats.avg,
      maxTemperature: tempStats.max,
      stdTemperature: tempStats.std,
      avgVibration: vibStats.avg,
      maxVibration: vibStats.max,
      stdVibration: vibStats.std,
      avgPressure: pressureStats.avg,
      minPressure: pressureStats.min,
      operatingHours: 0,
      cycleCount: 0,
      maintenanceAge: 30,
      failureHistory: 0,
    };
    const { predictWithXGBoost } = await import("../ml-xgboost-model.js");
    const prediction = predictWithXGBoost(model, features);
    const failureProbability = prediction.failureRisk;
    let remainingDays = 90;
    if (prediction.prediction === "critical") {
      remainingDays = 7;
    } else if (prediction.prediction === "warning") {
      remainingDays = 30;
    }
    const predictedFailureDate =
      prediction.prediction !== "healthy"
        ? new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000)
        : null;
    const recommendations =
      prediction.prediction === "critical"
        ? [
            "Critical health status detected (XGBoost)",
            "Schedule immediate maintenance",
            `Top factors: ${prediction.contributingFeatures
              .slice(0, 2)
              .map((f) => f.feature)
              .join(", ")}`,
          ]
        : prediction.prediction === "warning"
          ? [
              "Warning: Equipment health degrading (XGBoost)",
              "Schedule preventive maintenance",
              `Monitor: ${prediction.contributingFeatures
                .slice(0, 2)
                .map((f) => f.feature)
                .join(", ")}`,
            ]
          : ["Equipment health is good (XGBoost)", "Continue routine monitoring"];
    return {
      method: "ml_xgboost",
      failureProbability,
      confidence: prediction.confidence,
      predictedFailureDate,
      remainingDays,
      healthScore: Math.round((1 - failureProbability) * 100),
      recommendations,
    };
  });
}

export async function predictWithHybridModel(
  equipmentId: string,
  orgId: string
): Promise<MLPredictionResult | null> {
  try {
    const [lstmPrediction, xgboostPrediction, rfPrediction] = await Promise.all([
      predictFailureWithLSTM(equipmentId, orgId),
      predictHealthWithXGBoost(equipmentId, orgId),
      predictHealthWithRandomForest(equipmentId, orgId),
    ]);
    if (!lstmPrediction && !xgboostPrediction && !rfPrediction) {
      return null;
    }
    const availablePredictions: MLPredictionResult[] = [
      lstmPrediction,
      xgboostPrediction,
      rfPrediction,
    ].filter((p): p is MLPredictionResult => p !== null);
    if (availablePredictions.length === 1) {
      return availablePredictions[0];
    }
    const weights = availablePredictions.map((p) => {
      let w = 1;
      if (p.method === "ml_xgboost") {
        w = 1.2;
      } else if (p.method === "ml_lstm") {
        w = 1.1;
      }
      return p.confidence * w;
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const failureProbability = availablePredictions.reduce(
      (sum, p, idx) => sum + p.failureProbability * (weights[idx] / totalWeight),
      0
    );
    const confidence = availablePredictions.reduce(
      (sum, p, idx) => sum + p.confidence * (weights[idx] / totalWeight),
      0
    );
    const remainingDays = Math.round(
      availablePredictions.reduce(
        (sum, p, idx) => sum + p.remainingDays * (weights[idx] / totalWeight),
        0
      )
    );
    const predictedFailureDate =
      remainingDays > 0 ? new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000) : null;
    const modelNames = availablePredictions
      .map((p) =>
        p.method === "ml_lstm"
          ? "LSTM"
          : p.method === "ml_xgboost"
            ? "XGBoost"
            : p.method === "ml_rf"
              ? "Random Forest"
              : "Unknown"
      )
      .join(" + ");
    const uniqueRecommendations = Array.from(
      new Set(availablePredictions.flatMap((p) => p.recommendations))
    );
    return {
      method: "hybrid",
      failureProbability,
      confidence,
      predictedFailureDate,
      remainingDays,
      healthScore: Math.round((1 - failureProbability) * 100),
      recommendations: [
        `Ensemble prediction using ${modelNames}`,
        ...uniqueRecommendations.slice(0, 4),
      ],
    };
  } catch (error) {
    logger.error("MlPrediction", "Hybrid prediction error", error);
    return null;
  }
}

export async function predictWithEnsemble(
  equipmentId: string,
  orgId: string
): Promise<MLPredictionResult | null> {
  return withProtection("ml_ensemble", equipmentId, orgId, ensembleCircuitBreaker, async () => {
    const { isFeatureEnabled, ML_FEATURE_FLAGS } = await import("../ml-feature-flags.js");
    if (!isFeatureEnabled(ML_FEATURE_FLAGS.ENSEMBLE_PREDICTION, { orgId })) {
      return predictWithHybridModel(equipmentId, orgId);
    }
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rawTelemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
      equipmentId,
      startDate,
      endDate,
      orgId
    );
    const sanitized = sanitizeTelemetry(rawTelemetry);
    const telemetry = preprocessTelemetryForTraining(sanitized);
    if (telemetry.length < 5) {
      logger.warn("MlPrediction", "Insufficient telemetry for ensemble prediction");
      return null;
    }
    const timeGroups = new Map<string, typeof telemetry>();
    for (const t of telemetry) {
      const timeKey = t.ts.toISOString();
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)!.push(t);
    }
    const timeSeriesFeatures: TimeSeriesFeatures[] = [];
    for (const [timeKey, readings] of timeGroups.entries()) {
      const features: Record<string, number> = {};
      for (const reading of readings) {
        features[reading.sensorType] = reading.value;
      }
      timeSeriesFeatures.push({
        equipmentId,
        timestamp: new Date(timeKey),
        features,
        normalizedFeatures: {},
        label: 0,
      } as object as TimeSeriesFeatures);
    }
    const { ensemblePredict } = await import("../ml-ensemble-orchestrator.js");
    const ensemblePrediction = await ensemblePredict(orgId, equipmentId, timeSeriesFeatures, {
      useAdaptiveWeights: true,
      minConfidence: 0.3,
      enableShadowMode: false,
    });
    const predictedFailureDate =
      ensemblePrediction.daysToFailure === null
        ? null
        : new Date(Date.now() + ensemblePrediction.daysToFailure * 24 * 60 * 60 * 1000);
    return {
      method: ensemblePrediction.method as MLPredictionResult["method"],
      failureProbability: ensemblePrediction.failureProbability,
      confidence: ensemblePrediction.confidence,
      predictedFailureDate,
      remainingDays: ensemblePrediction.daysToFailure || 30,
      healthScore: Math.round((1 - ensemblePrediction.failureProbability) * 100),
      recommendations: ensemblePrediction.recommendations,
    };
  });
}
