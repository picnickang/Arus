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
