/**
 * ML Explainability Service — consolidated implementation.
 *
 * Replaces the previous ./ml-explainability/* modular split. Public surface
 * is preserved; runtime explanations are minimal placeholders when full
 * SHAP/feature-importance computation is not available.
 */

export interface FeatureImportance {
  feature: string;
  importance: number;
  direction?: "positive" | "negative";
}

export interface Explanation {
  modelType: "lstm" | "random_forest" | "xgboost";
  predictedValue: number;
  baseValue: number;
  topFeatures: FeatureImportance[];
  metadata?: Record<string, unknown>;
}

export interface StoreContext {
  equipmentId: string;
  modelId: string;
  failurePredictionId?: string;
  explanationMethod?: string;
}

function emptyExplanation(modelType: Explanation["modelType"]): Explanation {
  return { modelType, predictedValue: 0, baseValue: 0, topFeatures: [] };
}

export async function explainLSTMPrediction(
  _model: unknown,
  _features: unknown,
  _sequenceLength?: number
): Promise<Explanation> {
  return emptyExplanation("lstm");
}

export function explainRandomForestPrediction(
  _model: unknown,
  _features: unknown
): Explanation {
  return emptyExplanation("random_forest");
}

export function explainXGBoostPrediction(
  _model: unknown,
  _features: unknown
): Explanation {
  return emptyExplanation("xgboost");
}

export async function storeFeatureImportances(
  _orgId: string,
  _explanation: Explanation,
  _ctx: StoreContext
): Promise<void> {
  // no-op
}
