/**
 * ML Prediction Storage and Explainability
 */
import { IStorage } from "../storage.js";
import type { TimeSeriesFeatures, ClassificationFeatures } from "../ml-training-data.js";
import { schedulerEventBus } from "../events/scheduler-bus.js";
import { logger } from "../utils/logger.js";
import { getModel } from "./model-loader.js";
import { predictFailureWithLSTM, predictHealthWithRandomForest } from "./predictors.js";
import { sanitizeTelemetry, calculateStats, type MLPredictionResult } from "./types.js";

type RiskLevel = "low" | "medium" | "high" | "critical";

function calculateRiskLevel(failureProbability: number): RiskLevel {
  if (failureProbability >= 0.7) {return "critical";}
  if (failureProbability >= 0.4) {return "high";}
  if (failureProbability >= 0.2) {return "medium";}
  return "low";
}

function emitRulUpdateSafe(orgId: string, vesselId: string, equipmentId: string, remainingDays: number, riskLevel: RiskLevel, operatingMode: string | null | undefined): void {
  try {
    schedulerEventBus.emitRulUpdate({ orgId, vesselId, equipmentId, remainingDays, riskLevel, operatingMode });
  } catch (e) {
    logger.error("MlPrediction", "Failed to emit RUL event", e);
  }
}

export async function storePrediction(storage: IStorage, equipmentId: string, orgId: string, prediction: MLPredictionResult): Promise<void> {
  const equipment = await storage.getEquipment(orgId, equipmentId);
  if (!equipment) { return; }

  const riskLevel = calculateRiskLevel(prediction.failureProbability);
  await storage.createFailurePrediction({
    equipmentId, orgId, equipmentType: equipment.type,
    failureProbability: prediction.failureProbability, predictedFailureDate: prediction.predictedFailureDate,
    confidence: prediction.confidence, modelType: prediction.method, riskLevel,
    inputFeatures: {}, predictionTimestamp: new Date()
  }, orgId);

  emitRulUpdateSafe(orgId, equipment.vesselId || "unknown", equipmentId, prediction.remainingDays || 30, riskLevel, equipment.operatingMode);
}

async function buildTimeSeriesFeatures(telemetry: any[], equipmentId: string): Promise<TimeSeriesFeatures[]> {
  const timeGroups = new Map<string, typeof telemetry>();
  for (const t of telemetry) {
    const timeKey = t.ts.toISOString();
    if (!timeGroups.has(timeKey)) { timeGroups.set(timeKey, []); }
    timeGroups.get(timeKey)!.push(t);
  }

  const features: TimeSeriesFeatures[] = [];
  for (const [timeKey, readings] of timeGroups.entries()) {
    const featureMap: Record<string, number> = {};
    for (const reading of readings) { featureMap[reading.sensorType] = reading.value; }
    features.push({ equipmentId, timestamp: new Date(timeKey), features: featureMap, normalizedFeatures: {}, label: 0 });
  }
  return features;
}

function buildClassificationFeatures(telemetry: any[], equipmentId: string, equipmentType: string): ClassificationFeatures {
  const tempStats = calculateStats(telemetry.filter((t) => t.sensorType.toLowerCase().includes("temp")).map((t) => t.value));
  const vibStats = calculateStats(telemetry.filter((t) => t.sensorType.toLowerCase().includes("vib")).map((t) => t.value));
  const pressureStats = calculateStats(telemetry.filter((t) => t.sensorType.toLowerCase().includes("pressure")).map((t) => t.value));

  return {
    equipmentId, equipmentType,
    features: {
      avgTemperature: tempStats.avg, maxTemperature: tempStats.max, stdTemperature: tempStats.std,
      avgVibration: vibStats.avg, maxVibration: vibStats.max, stdVibration: vibStats.std,
      avgPressure: pressureStats.avg, minPressure: pressureStats.min,
      operatingHours: 0, cycleCount: 0, maintenanceAge: 30, failureHistory: 0
    },
    label: "healthy", failureRisk: 0
  };
}

async function computeAndStoreExplanation(
  storage: IStorage,
  modelPath: string,
  modelType: "lstm" | "random_forest",
  equipmentId: string,
  equipmentType: string,
  orgId: string,
  storedPrediction: any
): Promise<any | null> {
  const model = await getModel(modelPath, modelType);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const telemetry = sanitizeTelemetry(await storage.getTelemetryByEquipmentAndDateRange(equipmentId, startDate, endDate, orgId));

  if (modelType === "lstm") {
    const timeSeriesFeatures = await buildTimeSeriesFeatures(telemetry, equipmentId);
    const { explainLSTMPrediction, storeFeatureImportances } = await import("../ml-explainability-service.js");
    const explanation = await explainLSTMPrediction(model, timeSeriesFeatures, model.config.sequenceLength);
    if (storedPrediction) {
      const models = await storage.getMlModels(orgId, "lstm");
      const modelId = models.length > 0 ? models[0].id : undefined;
      if (modelId) { await storeFeatureImportances(storage, orgId, explanation, { equipmentId, modelId, failurePredictionId: storedPrediction.id, explanationMethod: "shap" }); }
    }
    return explanation;
  }

  const features = buildClassificationFeatures(telemetry, equipmentId, equipmentType);
  const { explainRandomForestPrediction, storeFeatureImportances } = await import("../ml-explainability-service.js");
  const explanation = explainRandomForestPrediction(model, features);
  if (storedPrediction) {
    const models = await storage.getMlModels(orgId, "random_forest");
    const modelId = models.length > 0 ? models[0].id : undefined;
    if (modelId) { await storeFeatureImportances(storage, orgId, explanation, { equipmentId, modelId, failurePredictionId: storedPrediction.id, explanationMethod: "shap" }); }
  }
  return explanation;
}

async function processAndStorePrediction(
  storage: IStorage,
  pred: MLPredictionResult,
  modelType: "lstm" | "random_forest",
  equipment: any,
  equipmentId: string,
  orgId: string
): Promise<{ prediction: MLPredictionResult; explanation: any | null; predictionId: number }> {
  const riskLevel = calculateRiskLevel(pred.failureProbability);
  let storedPrediction: any = null;
  let explanation: any = null;

  try {
    storedPrediction = await storage.createFailurePrediction({
      equipmentId, orgId, equipmentType: equipment.type,
      failureProbability: pred.failureProbability, predictedFailureDate: pred.predictedFailureDate,
      confidence: pred.confidence, modelType: pred.method,
      inputFeatures: {}, predictionTimestamp: new Date()
    }, orgId);
    emitRulUpdateSafe(orgId, equipment.vesselId || "unknown", equipmentId, pred.remainingDays || 30, riskLevel, equipment.operatingMode);
  } catch (e) {
    logger.error("MlPrediction", "Failed to store prediction", e);
  }

  try {
    const { getBestModel } = await import("../ml-training-pipeline.js");
    const modelPath = await getBestModel(storage, orgId, equipment.type, modelType);
    if (modelPath) {
      explanation = await computeAndStoreExplanation(storage, modelPath, modelType, equipmentId, equipment.type, orgId, storedPrediction);
    }
  } catch (e) {
    logger.error("MlPrediction", `Failed to compute SHAP values for ${modelType} prediction`, e);
    explanation = null;
  }

  return { prediction: pred, explanation, predictionId: storedPrediction?.id || 0 };
}

export async function predictWithExplainability(
  storage: IStorage,
  equipmentId: string,
  orgId: string,
  method: "lstm" | "random_forest" | "hybrid" = "hybrid"
): Promise<{ prediction: MLPredictionResult; explanation: any | null; predictionId: number } | null> {
  try {
    const equipment = await storage.getEquipment(orgId, equipmentId);
    if (!equipment) { return null; }

    if (method === "lstm" || method === "hybrid") {
      const prediction = await predictFailureWithLSTM(storage, equipmentId, orgId);
      if (prediction) { return processAndStorePrediction(storage, prediction, "lstm", equipment, equipmentId, orgId); }
    }

    if (method === "random_forest" || method === "hybrid") {
      const prediction = await predictHealthWithRandomForest(storage, equipmentId, orgId);
      if (prediction) { return processAndStorePrediction(storage, prediction, "random_forest", equipment, equipmentId, orgId); }
    }

    return null;
  } catch (error) {
    logger.error("MlPrediction", "Prediction with explainability error", error);
    return null;
  }
}
