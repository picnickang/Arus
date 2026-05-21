/**
 * ML Prediction Storage and Explainability
 */
import { domainEventBus, createDomainEvent } from "../lib/domain-event-bus/index.js";
import { logger } from "../utils/logger.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbTelemetryStorage } from "../db/telemetry/index.js";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";
import type { Equipment, EquipmentTelemetry, FailurePrediction } from "@shared/schema";
import type { TimeSeriesFeatures, ClassificationFeatures } from "../ml-training-data.js";
import { getModel } from "./model-loader.js";
import { predictFailureWithLSTM, predictHealthWithRandomForest } from "./predictors.js";
import { sanitizeTelemetry, calculateStats, type MLPredictionResult } from "./types.js";

type RiskLevel = "low" | "medium" | "high" | "critical";

function calculateRiskLevel(failureProbability: number): RiskLevel {
  if (failureProbability >= 0.7) {
    return "critical";
  }
  if (failureProbability >= 0.4) {
    return "high";
  }
  if (failureProbability >= 0.2) {
    return "medium";
  }
  return "low";
}

function getOperatingMode(equipment: Equipment): string | null | undefined {
  const record = equipment as unknown as Record<string, unknown>;
  const mode = record.operatingMode;
  return typeof mode === "string" ? mode : null;
}

function emitRulUpdateSafe(
  orgId: string,
  vesselId: string,
  equipmentId: string,
  remainingDays: number,
  riskLevel: RiskLevel,
  operatingMode: string | null | undefined
): void {
  try {
    domainEventBus.emit(
      "pdm.rul.updated",
      createDomainEvent("pdm.rul.updated", orgId, {
        vesselId,
        equipmentId,
        remainingDays,
        riskLevel,
        operatingMode: operatingMode ?? undefined,
      })
    );
  } catch (e) {
    logger.error("MlPrediction", "Failed to emit RUL event", e);
  }
}

export async function storePrediction(
  equipmentId: string,
  orgId: string,
  prediction: MLPredictionResult
): Promise<void> {
  const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
  if (!equipment) {
    return;
  }

  const riskLevel = calculateRiskLevel(prediction.failureProbability);
  await dbMlAnalyticsStorage.createFailurePrediction(
    {
      equipmentId,
      orgId,
      equipmentType: equipment.type ?? null,
      failureProbability: prediction.failureProbability,
      predictedFailureDate: prediction.predictedFailureDate,
      confidence: prediction.confidence,
      modelType: prediction.method,
      riskLevel,
      inputFeatures: {},
    },
    orgId
  );

  emitRulUpdateSafe(
    orgId,
    equipment.vesselId || "unknown",
    equipmentId,
    prediction.remainingDays || 30,
    riskLevel,
    getOperatingMode(equipment)
  );
}

async function buildTimeSeriesFeatures(
  telemetry: EquipmentTelemetry[],
  equipmentId: string
): Promise<TimeSeriesFeatures[]> {
  const timeGroups = new Map<string, EquipmentTelemetry[]>();
  for (const t of telemetry) {
    const ts = t.ts instanceof Date ? t.ts : new Date(t.ts);
    const timeKey = ts.toISOString();
    let bucket = timeGroups.get(timeKey);
    if (!bucket) {
      bucket = [];
      timeGroups.set(timeKey, bucket);
    }
    bucket.push(t);
  }

  const features: TimeSeriesFeatures[] = [];
  for (const [timeKey, readings] of timeGroups.entries()) {
    const signals: Record<string, number> = {};
    for (const reading of readings) {
      signals[reading.sensorType] = reading.value;
    }
    features.push({
      equipmentId,
      timestamp: new Date(timeKey),
      signals,
      label: 0,
    });
  }
  return features;
}

function buildClassificationFeatures(
  telemetry: EquipmentTelemetry[],
  equipmentId: string,
  equipmentType: string
): ClassificationFeatures {
  const tempStats = calculateStats(
    telemetry.filter((t) => t.sensorType.toLowerCase().includes("temp")).map((t) => t.value)
  );
  const vibStats = calculateStats(
    telemetry.filter((t) => t.sensorType.toLowerCase().includes("vib")).map((t) => t.value)
  );
  const pressureStats = calculateStats(
    telemetry.filter((t) => t.sensorType.toLowerCase().includes("pressure")).map((t) => t.value)
  );

  return {
    equipmentId,
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
    label: 0,
    metadata: {
      equipmentType,
      labelName: "healthy",
      failureRisk: 0,
    },
  };
}

type Explanation = unknown;

async function computeAndStoreExplanation(
  modelPath: string,
  modelType: "lstm" | "random_forest",
  equipmentId: string,
  equipmentType: string,
  orgId: string,
  storedPrediction: FailurePrediction | null
): Promise<Explanation | null> {
  const model = await getModel(modelPath, modelType);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const telemetry = sanitizeTelemetry(
    await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
      equipmentId,
      startDate,
      endDate,
      orgId
    )
  );

  if (modelType === "lstm") {
    const timeSeriesFeatures = await buildTimeSeriesFeatures(telemetry, equipmentId);
    const { explainLSTMPrediction, storeFeatureImportances } = await import(
      "../ml-explainability-service.js"
    );
    const explanation = await explainLSTMPrediction(
      model,
      timeSeriesFeatures,
      model.config.sequenceLength
    );
    if (storedPrediction) {
      const models = await dbMlAnalyticsStorage.getMlModels(orgId, "lstm");
      const modelId = models.length > 0 ? models[0].id : undefined;
      if (modelId) {
        await storeFeatureImportances(orgId, explanation, {
          equipmentId,
          modelId,
          failurePredictionId: storedPrediction.id,
          explanationMethod: "shap",
        });
      }
    }
    return explanation;
  }

  const features = buildClassificationFeatures(telemetry, equipmentId, equipmentType);
  const { explainRandomForestPrediction, storeFeatureImportances } = await import(
    "../ml-explainability-service.js"
  );
  const explanation = await explainRandomForestPrediction(model, features);
  if (storedPrediction) {
    const models = await dbMlAnalyticsStorage.getMlModels(orgId, "random_forest");
    const modelId = models.length > 0 ? models[0].id : undefined;
    if (modelId) {
      await storeFeatureImportances(orgId, explanation, {
        equipmentId,
        modelId,
        failurePredictionId: storedPrediction.id,
        explanationMethod: "shap",
      });
    }
  }
  return explanation;
}

async function processAndStorePrediction(
  pred: MLPredictionResult,
  modelType: "lstm" | "random_forest",
  equipment: Equipment,
  equipmentId: string,
  orgId: string
): Promise<{ prediction: MLPredictionResult; explanation: Explanation | null; predictionId: number }> {
  const riskLevel = calculateRiskLevel(pred.failureProbability);
  let storedPrediction: FailurePrediction | null = null;
  let explanation: Explanation | null = null;

  try {
    storedPrediction = await dbMlAnalyticsStorage.createFailurePrediction(
      {
        equipmentId,
        orgId,
        equipmentType: equipment.type ?? null,
        failureProbability: pred.failureProbability,
        predictedFailureDate: pred.predictedFailureDate,
        confidence: pred.confidence,
        modelType: pred.method,
        riskLevel,
        inputFeatures: {},
      },
      orgId
    );
    emitRulUpdateSafe(
      orgId,
      equipment.vesselId || "unknown",
      equipmentId,
      pred.remainingDays || 30,
      riskLevel,
      getOperatingMode(equipment)
    );
  } catch (e) {
    logger.error("MlPrediction", "Failed to store prediction", e);
  }

  try {
    const { getBestModel } = await import("../ml-training-pipeline.js");
    const modelPath = await getBestModel(orgId, equipment.type ?? "unknown", modelType);
    if (modelPath) {
      explanation = await computeAndStoreExplanation(
        modelPath,
        modelType,
        equipmentId,
        equipment.type ?? "unknown",
        orgId,
        storedPrediction
      );
    }
  } catch (e) {
    logger.error("MlPrediction", `Failed to compute SHAP values for ${modelType} prediction`, e);
    explanation = null;
  }

  return { prediction: pred, explanation, predictionId: storedPrediction?.id ?? 0 };
}

export async function predictWithExplainability(
  equipmentId: string,
  orgId: string,
  method: "lstm" | "random_forest" | "hybrid" = "hybrid"
): Promise<{
  prediction: MLPredictionResult;
  explanation: Explanation | null;
  predictionId: number;
} | null> {
  try {
    const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
    if (!equipment) {
      return null;
    }

    if (method === "lstm" || method === "hybrid") {
      const prediction = await predictFailureWithLSTM(equipmentId, orgId);
      if (prediction) {
        return processAndStorePrediction(prediction, "lstm", equipment, equipmentId, orgId);
      }
    }

    if (method === "random_forest" || method === "hybrid") {
      const prediction = await predictHealthWithRandomForest(equipmentId, orgId);
      if (prediction) {
        return processAndStorePrediction(
          prediction,
          "random_forest",
          equipment,
          equipmentId,
          orgId
        );
      }
    }

    return null;
  } catch (error) {
    logger.error("MlPrediction", "Prediction with explainability error", error);
    return null;
  }
}
