/**
 * ML Ensemble Weights
 *
 * Static and adaptive weight computation for model ensemble.
 */

import { logger } from "../utils/logger.js";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";
import type { ModelWeights } from "./types.js";

export const STATIC_WEIGHTS: Record<string, ModelWeights> = {
  main_engine: { lstm: 0.5, rf: 0.3, xgb: 0.2 },
  auxiliary_engine: { lstm: 0.5, rf: 0.3, xgb: 0.2 },
  hydraulic_pump: { lstm: 0.5, rf: 0.3, xgb: 0.2 },
  cooling_pump: { lstm: 0.5, rf: 0.3, xgb: 0.2 },
  fuel_pump: { lstm: 0.5, rf: 0.3, xgb: 0.2 },
  electrical_panel: { lstm: 0.2, rf: 0.5, xgb: 0.3 },
  navigation_equipment: { lstm: 0.2, rf: 0.5, xgb: 0.3 },
  communication_system: { lstm: 0.2, rf: 0.5, xgb: 0.3 },
  default: { lstm: 0.34, rf: 0.33, xgb: 0.33 },
};

export async function getAdaptiveWeights(
  orgId: string,
  equipmentType: string
): Promise<ModelWeights> {
  try {
    const lstmModels = await dbMlAnalyticsStorage.getMlModels(orgId, "lstm", "active");
    const rfModels = await dbMlAnalyticsStorage.getMlModels(orgId, "random_forest", "active");
    const xgbModels = await dbMlAnalyticsStorage.getMlModels(orgId, "xgboost", "active");

    type ModelRow = {
      targetEquipmentType?: string | null;
      performance?: { macroF1?: number; f1Score?: number; accuracy?: number } | null;
    };
    const pickBest = (models: ModelRow[]) => {
      return models
        .filter((m) => m.targetEquipmentType === equipmentType || m.targetEquipmentType == null)
        .sort((a, b) => {
          const scoreA =
            a.performance?.macroF1 ?? a.performance?.f1Score ?? a.performance?.accuracy ?? 0;
          const scoreB =
            b.performance?.macroF1 ?? b.performance?.f1Score ?? b.performance?.accuracy ?? 0;
          return scoreB - scoreA;
        })[0];
    };

    const bestLstm = pickBest(lstmModels as object as ModelRow[]);
    const bestRf = pickBest(rfModels as object as ModelRow[]);
    const bestXgb = pickBest(xgbModels as object as ModelRow[]);

    if (!bestLstm && !bestRf && !bestXgb) {
      return STATIC_WEIGHTS[equipmentType] ?? STATIC_WEIGHTS.default;
    }

    const score = (model: ModelRow | undefined) => {
      if (!model) {
        return 0;
      }
      const perf = model.performance;
      const rawScore = perf?.macroF1 ?? perf?.f1Score ?? perf?.accuracy ?? 0;
      return Math.max(0.5, Math.min(1, rawScore));
    };

    const lstmScore = score(bestLstm);
    const rfScore = score(bestRf);
    const xgbScore = score(bestXgb);

    const LSTM_BUMP = 1.05;
    const XGB_BUMP = 1.1;
    const RF_BUMP = 1;

    const lstmWeighted = lstmScore * LSTM_BUMP;
    const rfWeighted = rfScore * RF_BUMP;
    const xgbWeighted = xgbScore * XGB_BUMP;

    const totalWeight = lstmWeighted + rfWeighted + xgbWeighted;
    if (totalWeight === 0) {
      return STATIC_WEIGHTS[equipmentType] ?? STATIC_WEIGHTS.default;
    }

    return {
      lstm: lstmWeighted / totalWeight,
      rf: rfWeighted / totalWeight,
      xgb: xgbWeighted / totalWeight,
    };
  } catch (error) {
    logger.warn("MlEnsemble", "Adaptive weights failed, using static fallback", error);
    return STATIC_WEIGHTS[equipmentType] ?? STATIC_WEIGHTS.default;
  }
}

/**
 * @deprecated Use getAdaptiveWeights() for data-driven weights
 */
export function getModelWeights(equipmentType: string): ModelWeights {
  return STATIC_WEIGHTS[equipmentType] || STATIC_WEIGHTS.default;
}
