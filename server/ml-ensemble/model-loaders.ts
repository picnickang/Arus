/**
 * ML Ensemble Model Loaders
 *
 * Lazy loading of individual model predictions.
 */

import type { TimeSeriesFeatures } from "../ml-training-data.js";
import { getBestModel } from "../ml-training-pipeline.js";
import { logger } from "../utils/logger.js";
import type { ModelBreakdown, ModelConfidences } from "./types.js";
import { convertToClassificationFeatures } from "./features.js";

export interface ModelPredictionResult {
  predictions: number[];
  breakdown: ModelBreakdown;
  confidences: ModelConfidences;
}

export async function loadLstmPrediction(
  orgId: string,
  equipmentType: string,
  recentData: TimeSeriesFeatures[]
): Promise<{ probability: number; confidence?: number } | null> {
  try {
    const lstmModelPath = await getBestModel(orgId, equipmentType, "lstm");
    if (!lstmModelPath) {
      return null;
    }

    const { loadLSTMModel, predictWithLSTM } = await import("../ml-lstm-model.js");
    const lstmModel = await loadLSTMModel(lstmModelPath);
    const lstmPred = await predictWithLSTM(lstmModel, recentData);

    logger.debug(
      "MlEnsemble",
      `LSTM prediction: ${(lstmPred.failureProbability * 100).toFixed(1)}%`
    );

    return {
      probability: lstmPred.failureProbability,
      confidence: typeof lstmPred.confidence === "number" ? lstmPred.confidence : undefined,
    };
  } catch (error) {
    logger.warn("MlEnsemble", "LSTM prediction failed", error);
    return null;
  }
}

export async function loadRfPrediction(
  orgId: string,
  equipmentId: string,
  equipmentType: string,
  recentData: TimeSeriesFeatures[]
): Promise<{ probability: number; confidence?: number } | null> {
  try {
    const rfModelPath = await getBestModel(orgId, equipmentType, "random_forest");
    if (!rfModelPath) {
      return null;
    }

    const { loadRandomForest, predictWithRandomForest } = await import("../ml-random-forest.js");
    const rfModel = await loadRandomForest(rfModelPath);

    const classificationFeatures = await convertToClassificationFeatures(
      recentData,
      equipmentId,
      orgId
    );
    const rfPred = await predictWithRandomForest(rfModel, classificationFeatures);
    const failureProb = rfPred.failureRisk;

    logger.debug("MlEnsemble", `Random Forest prediction: ${(failureProb * 100).toFixed(1)}%`);

    return {
      probability: failureProb,
      confidence:
        typeof (rfPred as any).confidence === "number" ? (rfPred as any).confidence : undefined,
    };
  } catch (error) {
    logger.warn("MlEnsemble", "Random Forest prediction failed", error);
    return null;
  }
}

export async function loadXgbPrediction(
  orgId: string,
  equipmentId: string,
  equipmentType: string,
  recentData: TimeSeriesFeatures[]
): Promise<{ probability: number; confidence?: number } | null> {
  try {
    const xgbModelPath = await getBestModel(orgId, equipmentType, "xgboost");
    if (!xgbModelPath) {
      return null;
    }

    const { loadXGBoostModel, predictWithXGBoost } = await import("../ml-xgboost-model.js");
    const xgbModel = await loadXGBoostModel(xgbModelPath);

    const classificationFeatures = await convertToClassificationFeatures(
      recentData,
      equipmentId,
      orgId
    );
    const xgbPred = await predictWithXGBoost(xgbModel, classificationFeatures);
    const failureProb = xgbPred.failureRisk;

    logger.debug("MlEnsemble", `XGBoost prediction: ${(failureProb * 100).toFixed(1)}%`);

    return {
      probability: failureProb,
      confidence:
        typeof (xgbPred as any).confidence === "number" ? (xgbPred as any).confidence : undefined,
    };
  } catch (error) {
    logger.warn("MlEnsemble", "XGBoost prediction failed", error);
    return null;
  }
}

export async function collectModelPredictions(
  orgId: string,
  equipmentId: string,
  equipmentType: string,
  recentData: TimeSeriesFeatures[]
): Promise<ModelPredictionResult> {
  const predictions: number[] = [];
  const breakdown: ModelBreakdown = {};
  const confidences: ModelConfidences = {};

  const lstmResult = await loadLstmPrediction(orgId, equipmentType, recentData);
  if (lstmResult) {
    predictions.push(lstmResult.probability);
    breakdown.lstm = lstmResult.probability;
    if (lstmResult.confidence !== undefined) {
      confidences.lstm = lstmResult.confidence;
    }
  }

  const rfResult = await loadRfPrediction(orgId, equipmentId, equipmentType, recentData);
  if (rfResult) {
    predictions.push(rfResult.probability);
    breakdown.randomForest = rfResult.probability;
    if (rfResult.confidence !== undefined) {
      confidences.randomForest = rfResult.confidence;
    }
  }

  const xgbResult = await loadXgbPrediction(orgId, equipmentId, equipmentType, recentData);
  if (xgbResult) {
    predictions.push(xgbResult.probability);
    breakdown.xgboost = xgbResult.probability;
    if (xgbResult.confidence !== undefined) {
      confidences.xgboost = xgbResult.confidence;
    }
  }

  return { predictions, breakdown, confidences };
}
