import client from "prom-client";

// ===== ML PREDICTION METRICS =====
export const mlPredictionDuration = new client.Histogram({
  name: "arus_ml_prediction_duration_seconds",
  help: "ML prediction inference time in seconds",
  labelNames: ["model_type", "org_id"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const mlPredictionTotal = new client.Counter({
  name: "arus_ml_prediction_total",
  help: "Total ML predictions executed",
  labelNames: ["model_type", "status"],
});

export const mlPredictionConfidence = new client.Histogram({
  name: "arus_ml_prediction_confidence",
  help: "Distribution of ML prediction confidence scores",
  labelNames: ["model_type"],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
});

export const mlModelCacheHits = new client.Counter({
  name: "arus_ml_model_cache_hits_total",
  help: "ML model cache hits",
  labelNames: ["model_type"],
});

export const mlModelCacheMisses = new client.Counter({
  name: "arus_ml_model_cache_misses_total",
  help: "ML model cache misses (model loading required)",
  labelNames: ["model_type"],
});

export const mlCircuitBreakerState = new client.Gauge({
  name: "arus_ml_circuit_breaker_state",
  help: "ML circuit breaker state (0=closed, 1=open, 2=half-open)",
  labelNames: ["model_type"],
});

export const mlSemaphoreWaitTime = new client.Histogram({
  name: "arus_ml_semaphore_wait_seconds",
  help: "Time spent waiting for ML inference semaphore",
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5],
});

// Helper functions
type ModelType = "lstm" | "random_forest" | "xgboost" | "ensemble";

export function recordMlPredictionDuration(
  modelType: ModelType,
  orgId: string,
  durationMs: number
) {
  mlPredictionDuration.observe({ model_type: modelType, org_id: orgId }, durationMs / 1000);
}

export function recordMlPrediction(
  modelType: ModelType,
  status: "success" | "error" | "circuit_open"
) {
  mlPredictionTotal.inc({ model_type: modelType, status });
}

export function recordMlPredictionConfidence(modelType: ModelType, confidence: number) {
  mlPredictionConfidence.observe({ model_type: modelType }, confidence);
}

export function recordMlModelCacheHit(modelType: "lstm" | "random_forest" | "xgboost") {
  mlModelCacheHits.inc({ model_type: modelType });
}

export function recordMlModelCacheMiss(modelType: "lstm" | "random_forest" | "xgboost") {
  mlModelCacheMisses.inc({ model_type: modelType });
}

export function setMlCircuitBreakerState(modelType: ModelType, state: 0 | 1 | 2) {
  mlCircuitBreakerState.set({ model_type: modelType }, state);
}

export function recordMlSemaphoreWait(waitMs: number) {
  mlSemaphoreWaitTime.observe(waitMs / 1000);
}

// ===== Wave 3.1: Model drift + accuracy KPIs =====

/**
 * Population Stability Index per (model, feature). Computed externally
 * on a rolling window and pushed to this gauge so Grafana can chart it.
 * Convention:
 *   PSI <  0.1   — stable
 *   PSI 0.1–0.25 — slight drift, monitor
 *   PSI >  0.25  — significant drift, retrain candidate
 */
export const mlFeaturePsi = new client.Gauge({
  name: "arus_ml_feature_psi",
  help: "Population Stability Index per model feature (drift detection).",
  labelNames: ["model_id", "feature", "equipment_class"],
});

/** KL divergence as a secondary drift signal (some teams prefer it to PSI). */
export const mlFeatureKlDivergence = new client.Gauge({
  name: "arus_ml_feature_kl_divergence",
  help: "KL divergence per model feature (drift detection).",
  labelNames: ["model_id", "feature", "equipment_class"],
});

/** Rolling-window MAE for regression models. */
export const mlModelRollingMae = new client.Gauge({
  name: "arus_ml_model_rolling_mae",
  help: "Rolling 30-day MAE per model (vs deployed baseline).",
  labelNames: ["model_id", "equipment_class"],
});

/** Rolling-window accuracy for classification models. */
export const mlModelRollingAccuracy = new client.Gauge({
  name: "arus_ml_model_rolling_accuracy",
  help: "Rolling 30-day accuracy per model (vs deployed baseline).",
  labelNames: ["model_id", "equipment_class"],
});

/** Accuracy decay ratio: current / baseline. <0.95 indicates retrain. */
export const mlModelAccuracyDecayRatio = new client.Gauge({
  name: "arus_ml_model_accuracy_decay_ratio",
  help: "Current rolling accuracy divided by deploy-time baseline accuracy.",
  labelNames: ["model_id", "equipment_class"],
});

/**
 * Compute PSI for two distributions binned identically. Caller supplies
 * the expected (training) and actual (production) histograms; this
 * function does the standard sum( (a - e) * ln(a / e) ). Empty bins are
 * floored to 1e-4 to avoid log(0).
 */
export function computePsi(expected: number[], actual: number[]): number {
  if (expected.length !== actual.length || expected.length === 0) {
    return 0;
  }
  const eSum = expected.reduce((s, v) => s + v, 0) || 1;
  const aSum = actual.reduce((s, v) => s + v, 0) || 1;
  let psi = 0;
  for (let i = 0; i < expected.length; i++) {
    const e = Math.max((expected[i] ?? 0) / eSum, 1e-4);
    const a = Math.max((actual[i] ?? 0) / aSum, 1e-4);
    psi += (a - e) * Math.log(a / e);
  }
  return psi;
}

export function recordModelDrift(
  modelId: string,
  feature: string,
  equipmentClass: string,
  psi: number,
  klDivergence?: number
) {
  mlFeaturePsi.set({ model_id: modelId, feature, equipment_class: equipmentClass }, psi);
  if (typeof klDivergence === "number") {
    mlFeatureKlDivergence.set(
      { model_id: modelId, feature, equipment_class: equipmentClass },
      klDivergence
    );
  }
}

export function recordModelPerformance(
  modelId: string,
  equipmentClass: string,
  metrics: { mae?: number; accuracy?: number; baselineAccuracy?: number }
) {
  if (typeof metrics.mae === "number") {
    mlModelRollingMae.set({ model_id: modelId, equipment_class: equipmentClass }, metrics.mae);
  }
  if (typeof metrics.accuracy === "number") {
    mlModelRollingAccuracy.set(
      { model_id: modelId, equipment_class: equipmentClass },
      metrics.accuracy
    );
    if (typeof metrics.baselineAccuracy === "number" && metrics.baselineAccuracy > 0) {
      mlModelAccuracyDecayRatio.set(
        { model_id: modelId, equipment_class: equipmentClass },
        metrics.accuracy / metrics.baselineAccuracy
      );
    }
  }
}
