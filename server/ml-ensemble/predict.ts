/**
 * ML Ensemble Prediction
 *
 * Main ensemble prediction combining LSTM, Random Forest, and XGBoost.
 */

import type { TimeSeriesFeatures } from "../ml-training-data.js";
import type { CalibrationMethod } from "../ml-calibration.js";
import { getFeatureFlags } from "../ml-feature-flags.js";
import { applyCalibration } from "../ml-calibration.js";
import { logger } from "../utils/logger.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";

import type { EnsemblePrediction, EnsembleConfig } from "./types.js";
import { getAdaptiveWeights, STATIC_WEIGHTS } from "./weights.js";
import { calculateAgreement, generateRecommendations } from "./helpers.js";
import { collectModelPredictions } from "./model-loaders.js";
import { persistPrediction } from "./persistence.js";

export async function ensemblePredict(
  orgId: string,
  equipmentId: string,
  recentData: TimeSeriesFeatures[],
  config?: Partial<EnsembleConfig>
): Promise<EnsemblePrediction> {
  const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
  if (!equipment) {
    throw new Error(`Equipment ${equipmentId} not found`);
  }

  const equipmentType = equipment.type;

  const ensembleConfig: EnsembleConfig = {
    equipmentType,
    useAdaptiveWeights: config?.useAdaptiveWeights ?? true,
    minConfidence: config?.minConfidence ?? 0.3,
    enableShadowMode: config?.enableShadowMode ?? false,
  };

  const flags = await getFeatureFlags(orgId);
  const useEnsemble = flags.enableEnsemble !== false;

  if (!useEnsemble && !ensembleConfig.enableShadowMode) {
    throw new Error("Ensemble predictions are disabled. Enable via feature flags.");
  }

  const weights = ensembleConfig.useAdaptiveWeights
    ? await getAdaptiveWeights(orgId, equipmentType)
    : STATIC_WEIGHTS.default;

  logger.debug(
    "MlEnsemble",
    `Predicting for ${equipmentType} with ${ensembleConfig.useAdaptiveWeights ? "adaptive" : "static"} weights`,
    weights
  );

  const {
    predictions,
    breakdown: modelBreakdown,
    confidences: modelConfs,
  } = await collectModelPredictions(orgId, equipmentId, equipmentType, recentData);

  if (predictions.length === 0) {
    logger.error("MlEnsemble", "CRITICAL: No models available for prediction");
    throw new Error(
      "No models available for prediction. Train at least one model (LSTM, RF, or XGBoost) first."
    );
  }

  const availableModels = Object.keys(modelBreakdown).filter(
    (k) => modelBreakdown[k as keyof typeof modelBreakdown] !== undefined
  );
  logger.info("MlEnsemble", `Using ${predictions.length} models: ${availableModels.join(", ")}`);

  if (predictions.length < 2) {
    logger.warn(
      "MlEnsemble",
      `Only ${predictions.length} model available - ensemble confidence will be reduced`
    );
  }

  let weightedSum = 0;
  let totalWeight = 0;

  if (modelBreakdown.lstm !== undefined) {
    weightedSum += modelBreakdown.lstm * weights.lstm;
    totalWeight += weights.lstm;
  }

  if (modelBreakdown.randomForest !== undefined) {
    weightedSum += modelBreakdown.randomForest * weights.rf;
    totalWeight += weights.rf;
  }

  if (modelBreakdown.xgboost !== undefined) {
    weightedSum += modelBreakdown.xgboost * weights.xgb;
    totalWeight += weights.xgb;
  }

  let finalPrediction = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let calibrationMethod: CalibrationMethod | null = null;
  try {
    const calibrationCurves = await dbMlAnalyticsStorage.getCalibrationCurves(
      orgId,
      undefined,
      equipmentId,
      "active"
    );

    if (calibrationCurves.length > 0) {
      const latestCurve = calibrationCurves[0];
      calibrationMethod = latestCurve.method;
      const calibratedProbability = applyCalibration(
        finalPrediction,
        latestCurve.parameters as any,
        latestCurve.method
      );
      logger.debug(
        "MlEnsemble",
        `Calibration applied: ${(finalPrediction * 100).toFixed(1)}% → ${(calibratedProbability * 100).toFixed(1)}% (${latestCurve.method})`
      );
      finalPrediction = calibratedProbability;
    } else {
      logger.debug("MlEnsemble", "No calibration curve available - using raw ensemble prediction");
    }
  } catch (error) {
    logger.warn("MlEnsemble", "Calibration failed, using raw prediction", error);
  }

  const agreement = calculateAgreement(predictions);
  const availabilityLookup = [0, 0.5, 0.75, 1];
  const availability = availabilityLookup[predictions.length] ?? 1;

  const availableConfs = [modelConfs.lstm, modelConfs.randomForest, modelConfs.xgboost].filter(
    (c): c is number => typeof c === "number"
  );
  const avgModelConf =
    availableConfs.length > 0
      ? availableConfs.reduce((sum, c) => sum + c, 0) / availableConfs.length
      : 0.7;

  const confidence = Math.max(0, Math.min(1, agreement * availability * avgModelConf));

  let daysToFailure: number | null = null;
  if (finalPrediction > 0.5) {
    daysToFailure = Math.round(30 * (1 - finalPrediction));
  }

  const recommendations = generateRecommendations(
    finalPrediction,
    confidence,
    agreement,
    equipmentType
  );

  const result: EnsemblePrediction = {
    failureProbability: finalPrediction,
    confidence,
    daysToFailure,
    method: "ensemble",
    modelBreakdown,
    modelWeights: weights,
    agreement,
    recommendations,
  };

  logger.info("MlEnsemble", "Ensemble prediction completed", {
    orgId,
    equipmentId,
    equipmentType,
    availableModels: availableModels.join(","),
    weights: {
      lstm: weights.lstm.toFixed(3),
      rf: weights.rf.toFixed(3),
      xgb: weights.xgb.toFixed(3),
      adaptive: ensembleConfig.useAdaptiveWeights,
    },
    finalPrediction: finalPrediction.toFixed(4),
    confidence: confidence.toFixed(4),
    agreement: agreement.toFixed(4),
    availability: availability.toFixed(2),
    avgModelConf: avgModelConf.toFixed(3),
    modelCount: predictions.length,
    shadowMode: ensembleConfig.enableShadowMode,
    belowMinConf: confidence < ensembleConfig.minConfidence,
  });

  if (confidence < ensembleConfig.minConfidence) {
    logger.warn(
      "MlEnsemble",
      `Confidence ${(confidence * 100).toFixed(1)}% below minimum threshold ${(ensembleConfig.minConfidence * 100).toFixed(0)}%`
    );
    result.recommendations.unshift(
      `⚠️ Low confidence (${(confidence * 100).toFixed(1)}%) - prediction may be unreliable`
    );
  }

  if (!ensembleConfig.enableShadowMode && confidence >= ensembleConfig.minConfidence) {
    await persistPrediction({
      orgId,
      equipmentId,
      equipmentType,
      finalPrediction,
      confidence,
      agreement,
      daysToFailure,
      modelBreakdown,
      weights,
      recommendations,
    });
  }

  return result;
}
