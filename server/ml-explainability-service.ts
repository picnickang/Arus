/**
 * ML Explainability Service — Push A1 real implementation.
 *
 * Replaces the previous no-op stubs with a model-agnostic, defensible
 * per-feature attribution path:
 *
 *  1. Permutation importance — for each feature, perturb the value to its
 *     fleet baseline (or zero if no baseline known) and measure the delta
 *     in the model's predicted failure probability. Larger absolute deltas
 *     mean the model is more sensitive to that feature for the current
 *     instance.
 *  2. Direction sign — taken from the delta: a positive delta when the
 *     feature is suppressed means the feature was *increasing* failure
 *     probability (positive contribution); negative means the feature was
 *     suppressing risk.
 *  3. Importances are normalised so the top features in `topFeatures` sum
 *     to ~1.0 — they are relative, not calibrated SHAP values, but they
 *     are real per-instance attributions rather than the previous
 *     `emptyExplanation` placeholder.
 *
 * Persistence: `storeFeatureImportances` writes one
 * `prediction_explanations` row per top feature, linked to both the
 * `failure_predictions.id` and the `inference_runs.id` if available.
 *
 * NOTE: this is a TS-side TreeSHAP-style approximation that works for
 * any model exposing a deterministic `predict(features) -> probability`
 * surface. A full TreeSHAP requires the model's tree structure and is
 * planned for the XGBoost ONNX promotion path in Push A2/A3.
 */

import { db } from "./db";
import {
  predictionExplanations,
  featureImportances as featureImportancesTable,
} from "@shared/schema";
import { createLogger } from "./lib/structured-logger";

const logger = createLogger("MlExplainability");

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
  failurePredictionId?: string | number;
  inferenceRunId?: string;
  explanationMethod?: string;
}

interface PredictableModel {
  predict?: (features: Record<string, number>) => number | { failureRisk?: number; failureProbability?: number };
  classify?: (features: Record<string, number>) => { failureRisk?: number };
}

const DEFAULT_BASELINES: Record<string, number> = {
  avgTemperature: 55,
  meanTemp: 55,
  maxTemperature: 65,
  stdTemperature: 5,
  avgVibration: 2.0,
  meanVibration: 2.0,
  rmsVibration: 2.0,
  maxVibration: 3.0,
  stdVibration: 0.5,
  avgPressure: 200,
  meanPressure: 200,
  minPressure: 150,
  stdPressure: 10,
  kurtosis: 3.0,
  skewness: 0,
  peakToPeak: 5.0,
  operatingHours: 1000,
  cycleCount: 5000,
  maintenanceAge: 30,
  failureHistory: 0,
};

function coerceProb(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0), 1);
  }
  if (value && typeof value === "object") {
    const v = value as { failureRisk?: number; failureProbability?: number };
    if (typeof v.failureRisk === "number") return coerceProb(v.failureRisk);
    if (typeof v.failureProbability === "number") return coerceProb(v.failureProbability);
  }
  return 0.1;
}

function extractFeatureMap(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const candidate = (input as { features?: unknown }).features ?? input;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(candidate as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Run permutation importance over every feature in `features` against the
 * given model, using `predictFn` to obtain the model's probability output.
 * Returns the top-N most-impactful features with normalised importances
 * and signed directions.
 */
async function permutationImportance(
  features: Record<string, number>,
  predictFn: (f: Record<string, number>) => number | Promise<number>,
  topN = 8
): Promise<{ baseValue: number; predictedValue: number; topFeatures: FeatureImportance[] }> {
  const baselineProb = await predictFn(features);
  const results: { feature: string; delta: number; direction: "positive" | "negative" }[] = [];

  for (const [name, currentValue] of Object.entries(features)) {
    const baseline = DEFAULT_BASELINES[name] ?? 0;
    if (baseline === currentValue) continue;
    const perturbed = { ...features, [name]: baseline };
    let withoutProb: number;
    try {
      withoutProb = await predictFn(perturbed);
    } catch (err) {
      logger.warn("Permutation perturbation threw — skipping feature", {
        feature: name,
        err: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const delta = baselineProb - withoutProb;
    if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6) continue;
    results.push({
      feature: name,
      delta: Math.abs(delta),
      direction: delta > 0 ? "positive" : "negative",
    });
  }

  results.sort((a, b) => b.delta - a.delta);
  const top = results.slice(0, topN);
  const totalDelta = top.reduce((s, r) => s + r.delta, 0) || 1;

  return {
    baseValue: 0.1,
    predictedValue: baselineProb,
    topFeatures: top.map((r) => ({
      feature: r.feature,
      importance: Math.round((r.delta / totalDelta) * 1000) / 1000,
      direction: r.direction,
    })),
  };
}

export async function explainLSTMPrediction(
  model: unknown,
  features: unknown,
  _sequenceLength?: number
): Promise<Explanation> {
  const featureMap = extractFeatureMap(features);
  if (Object.keys(featureMap).length === 0) {
    return { modelType: "lstm", predictedValue: 0, baseValue: 0, topFeatures: [] };
  }

  const m = model as PredictableModel;
  const predictFn = (f: Record<string, number>): number => {
    if (typeof m.predict === "function") return coerceProb(m.predict(f));
    return 0.1;
  };

  try {
    const out = await permutationImportance(featureMap, predictFn);
    return { modelType: "lstm", ...out, metadata: { method: "permutation" } };
  } catch (err) {
    logger.warn("LSTM explanation failed — returning empty", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { modelType: "lstm", predictedValue: 0, baseValue: 0, topFeatures: [] };
  }
}

export async function explainRandomForestPrediction(
  model: unknown,
  features: unknown
): Promise<Explanation> {
  const featureMap = extractFeatureMap(features);
  if (Object.keys(featureMap).length === 0) {
    return { modelType: "random_forest", predictedValue: 0, baseValue: 0, topFeatures: [] };
  }

  const m = model as PredictableModel;
  const predictFn = (f: Record<string, number>): number => {
    const candidate = m.classify?.(f) ?? m.predict?.(f);
    return coerceProb(candidate);
  };

  try {
    const out = await permutationImportance(featureMap, predictFn);
    return { modelType: "random_forest", ...out, metadata: { method: "permutation" } };
  } catch (err) {
    logger.warn("RF explanation failed — returning empty", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { modelType: "random_forest", predictedValue: 0, baseValue: 0, topFeatures: [] };
  }
}

/**
 * Async-capable explainer. `predict` may be sync or async — both are
 * supported, which is required because real model adapters (ONNX, ML
 * services) return Promises. A sync predict is run inline.
 */
export interface AsyncPredictableModel {
  predict: (features: Record<string, number>) => number | Promise<number>;
}

export async function explainXGBoostPrediction(
  model: unknown,
  features: unknown
): Promise<Explanation> {
  const featureMap = extractFeatureMap(features);
  if (Object.keys(featureMap).length === 0) {
    return { modelType: "xgboost", predictedValue: 0, baseValue: 0, topFeatures: [] };
  }

  const m = model as PredictableModel & Partial<AsyncPredictableModel>;
  const predictFn = async (f: Record<string, number>): Promise<number> => {
    if (typeof m.predict !== "function") return 0.1;
    const out = m.predict(f) as number | Promise<number> | { failureProbability?: number };
    if (out instanceof Promise) return coerceProb(await out);
    return coerceProb(out);
  };

  try {
    const out = await permutationImportance(featureMap, predictFn);
    return { modelType: "xgboost", ...out, metadata: { method: "permutation" } };
  } catch (err) {
    logger.warn("XGBoost explanation failed — returning empty", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { modelType: "xgboost", predictedValue: 0, baseValue: 0, topFeatures: [] };
  }
}

export async function storeFeatureImportances(
  orgId: string,
  explanation: Explanation,
  ctx: StoreContext
): Promise<void> {
  if (!explanation.topFeatures.length) return;

  const predictionIdNum =
    typeof ctx.failurePredictionId === "number"
      ? ctx.failurePredictionId
      : typeof ctx.failurePredictionId === "string"
        ? Number.parseInt(ctx.failurePredictionId, 10)
        : NaN;

  try {
    if (Number.isFinite(predictionIdNum) && ctx.inferenceRunId) {
      await db.insert(predictionExplanations).values(
        explanation.topFeatures.map((f) => ({
          predictionId: predictionIdNum,
          inferenceRunId: ctx.inferenceRunId!,
          featureName: f.feature,
          importance: f.importance,
          featureValue: null,
          baselineValue: DEFAULT_BASELINES[f.feature] ?? null,
          direction:
            f.direction === "positive"
              ? "increasing"
              : f.direction === "negative"
                ? "decreasing"
                : "stable",
        }))
      );
      return;
    }

    const shapValues: Record<string, number> = {};
    const featureValues: Record<string, number> = {};
    const topFeatures: { feature: string; importance: number; direction?: string }[] = [];
    for (const f of explanation.topFeatures) {
      shapValues[f.feature] = f.importance * (f.direction === "negative" ? -1 : 1);
      featureValues[f.feature] = DEFAULT_BASELINES[f.feature] ?? 0;
      topFeatures.push(f);
    }
    await db.insert(featureImportancesTable).values({
      orgId,
      modelId: ctx.modelId,
      equipmentId: ctx.equipmentId,
      failurePredictionId: Number.isFinite(predictionIdNum) ? predictionIdNum : null,
      baseValue: explanation.baseValue,
      shapValues,
      topFeatures,
      featureValues,
      explanationMethod: ctx.explanationMethod ?? "permutation",
    });
  } catch (err) {
    logger.warn("Failed to persist feature importances — non-fatal", {
      orgId,
      modelId: ctx.modelId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
