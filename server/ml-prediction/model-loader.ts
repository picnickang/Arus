/**
 * ML Model Loading and Caching with Protection Wrapper
 */
import { createModelCache } from "../ml-lru-cache.js";
import { inferenceSemaphore } from "../ml-semaphore.js";
import { mlObservability } from "../ml-observability.js";
import { recordMlPredictionDuration, recordMlPrediction, recordMlPredictionConfidence, recordMlModelCacheHit, recordMlModelCacheMiss, setMlCircuitBreakerState, recordMlSemaphoreWait } from "../observability.js";
import { recordPrediction as recordProvenancePrediction } from "../governance/provenance.js";
import { incrementPredCount } from "../governance/lineage.js";
import { logger } from "../utils/logger.js";
import { isPrediction, structuredLog } from "./types.js";

const modelCache = createModelCache(6);

export async function getModel(modelPath: string, modelType: "lstm" | "random_forest"): Promise<any> {
  const cached = modelCache.get(modelPath);
  if (cached) {
    structuredLog({ method: "getModel", status: "info", details: { modelPath, modelType, cacheHit: true } });
    recordMlModelCacheHit(modelType === "random_forest" ? "random_forest" : "lstm");
    return cached;
  }
  structuredLog({ method: "getModel", status: "info", details: { modelPath, modelType, cacheHit: false, loading: true } });
  recordMlModelCacheMiss(modelType === "random_forest" ? "random_forest" : "lstm");
  let model;
  if (modelType === "lstm") {
    const { loadLSTMModel } = await import("../ml-lstm-model.js");
    model = await loadLSTMModel(modelPath);
  } else {
    const { loadRandomForest } = await import("../ml-random-forest.js");
    model = await loadRandomForest(modelPath);
  }
  modelCache.set(modelPath, model);
  return model;
}

const MODEL_TYPE_MAP: Record<string, "lstm" | "random_forest" | "xgboost" | "ensemble"> = {
  ml_lstm: "lstm", ml_rf: "random_forest", ml_random_forest: "random_forest", ml_xgboost: "xgboost", hybrid: "ensemble", ensemble: "ensemble", ml_ensemble: "ensemble"
};

export async function withProtection<T>(method: string, equipmentId: string, orgId: string, circuitBreaker: any, fn: () => Promise<T>): Promise<T | null> {
  const startTime = Date.now();
  const modelType = MODEL_TYPE_MAP[method] || "ensemble";
  if (circuitBreaker.isOpen()) {
    structuredLog({ method, equipmentId, orgId, status: "warning", details: { reason: "circuit_breaker_open" } });
    recordMlPrediction(modelType, "circuit_open");
    setMlCircuitBreakerState(modelType, 1);
    return null;
  }
  const semaphoreWaitStart = Date.now();
  return inferenceSemaphore.execute(async () => {
    const semaphoreWaitMs = Date.now() - semaphoreWaitStart;
    recordMlSemaphoreWait(semaphoreWaitMs);
    try {
      const result = await fn();
      const latencyMs = Date.now() - startTime;
      if (isPrediction(result)) {
        circuitBreaker.recordSuccess();
        mlObservability.logSuccess(equipmentId, orgId, method, result, latencyMs);
        recordMlPredictionDuration(modelType, orgId, latencyMs);
        recordMlPrediction(modelType, "success");
        recordMlPredictionConfidence(modelType, result.confidence);
        setMlCircuitBreakerState(modelType, 0);
        structuredLog({ method, equipmentId, orgId, latencyMs, status: "success", details: { failureProbability: result.failureProbability, confidence: result.confidence } });
        try {
          const engineMap: Record<string, "tfjs" | "onnx" | "xgboost" | "rf"> = { ml_lstm: "tfjs", ml_rf: "rf", ml_random_forest: "rf", ml_xgboost: "xgboost", hybrid: "tfjs", ensemble: "tfjs" };
          await recordProvenancePrediction({ orgId, equipmentId, modelId: method, profile: `${method}_profile`, anomalyScore: result.failureProbability, rawSliceHash: `hash_${equipmentId}_${Date.now()}`, engine: engineMap[method] || "tfjs" });
          await incrementPredCount(method, orgId);
        } catch (error) { logger.warn("MlPrediction", `Failed to record provenance event for ${equipmentId}`, error); }
      } else if (result === null) {
        structuredLog({ method, equipmentId, orgId, latencyMs, status: "info", details: { reason: "no_prediction_available" } });
      }
      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      circuitBreaker.recordFailure();
      mlObservability.logFailure(equipmentId, orgId, method, error as Error, latencyMs);
      recordMlPredictionDuration(modelType, orgId, latencyMs);
      recordMlPrediction(modelType, "error");
      structuredLog({ method, equipmentId, orgId, latencyMs, status: "error", details: { error: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  });
}
