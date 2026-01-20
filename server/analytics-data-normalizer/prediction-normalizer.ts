/**
 * Failure Prediction Normalizer
 */

import type { FailurePrediction } from "@shared/schema-runtime";
import { expandRiskLevel, expandFailureMode, clampToRange } from "./helpers";

export function normalizeFailurePrediction(prediction: FailurePrediction): FailurePrediction {
  return {
    ...prediction,
    predictionTimestamp: prediction.predictionTimestamp || new Date(),
    failureProbability: clampToRange(prediction.failureProbability ?? 0, 0, 1),
    riskLevel: expandRiskLevel(prediction.riskLevel),
    failureMode: expandFailureMode(prediction.failureMode),
    predictedFailureDate: prediction.predictedFailureDate || null,
    remainingUsefulLife: prediction.remainingUsefulLife ?? null,
    confidenceInterval: prediction.confidenceInterval || null,
    inputFeatures: prediction.inputFeatures ?? {},
    maintenanceRecommendations: prediction.maintenanceRecommendations ?? [],
    costImpact: prediction.costImpact ?? null,
    metadata: prediction.metadata ?? {},
  };
}

export function normalizeFailurePredictions(predictions: FailurePrediction[]): FailurePrediction[] {
  return predictions.map(normalizeFailurePrediction);
}
