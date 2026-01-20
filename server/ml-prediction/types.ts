/**
 * ML Prediction Types and Utilities
 */
import type { EquipmentTelemetry } from "@shared/schema-runtime";
import { logger } from "../utils/logger.js";

export type MLDataStatus = "sufficient_data" | "limited_data" | "no_data" | "stale_data";

export interface MLPredictionResult {
  method: "ml_lstm" | "ml_rf" | "ml_xgboost" | "hybrid" | "ensemble";
  failureProbability: number;
  confidence: number;
  predictedFailureDate: Date | null;
  remainingDays: number;
  healthScore: number;
  recommendations: string[];
  dataStatus?: MLDataStatus;
  dataStatusReason?: string;
}

export function isPrediction(x: any): x is MLPredictionResult {
  return x && typeof x === "object" && "failureProbability" in x && "confidence" in x && "method" in x && typeof x.failureProbability === "number" && typeof x.confidence === "number";
}

export function structuredLog(data: { method: string; equipmentId?: string; orgId?: string; latencyMs?: number; status: "success" | "error" | "warning" | "info"; details?: any }) {
  const metadata = { equipmentId: data.equipmentId, orgId: data.orgId, latencyMs: data.latencyMs, ...(data.details ?? {}) };
  if (data.status === "error") {logger.error("MlPrediction", data.method, metadata);}
  else if (data.status === "warning") {logger.warn("MlPrediction", data.method, metadata);}
  else {logger.info("MlPrediction", data.method, metadata);}
}

export function sanitizeTelemetry(telemetry: EquipmentTelemetry[]): EquipmentTelemetry[] {
  let invalidTimestampCount = 0, invalidValueCount = 0;
  const sanitized = telemetry.filter((t) => {
    const ts = t.ts instanceof Date ? t.ts : new Date(t.ts);
    if (!ts || Number.isNaN(ts.getTime())) { invalidTimestampCount++; return false; }
    if (!Number.isFinite(t.value)) { invalidValueCount++; return false; }
    return true;
  }).map((t) => ({ ...t, ts: t.ts instanceof Date ? t.ts : new Date(t.ts) }));
  if (invalidTimestampCount > 0 || invalidValueCount > 0) {
    structuredLog({ method: "sanitizeTelemetry", status: "warning", details: { invalidTimestamps: invalidTimestampCount, invalidValues: invalidValueCount, totalInput: telemetry.length, totalOutput: sanitized.length } });
  }
  return sanitized;
}

export function calculateStats(values: number[]) {
  if (values.length === 0) {return { avg: 0, max: 0, min: 0, std: 0 };}
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  return { avg, max, min, std };
}

export function generateRecommendations(failureProbability: number, model: string): string[] {
  const recommendations: string[] = [];
  const suffix = model !== "lstm" ? ` (${model})` : "";
  if (failureProbability > 0.7) {
    recommendations.push(`Critical: Schedule immediate inspection${suffix}`, "Prepare for possible equipment replacement");
  } else if (failureProbability > 0.5) {
    recommendations.push(`Schedule maintenance within 7 days${suffix}`, "Monitor telemetry closely");
  } else if (failureProbability > 0.3) {
    recommendations.push(`Increase monitoring frequency${suffix}`, "Review maintenance schedule");
  } else {
    recommendations.push(`Equipment health is good${suffix}`, "Continue routine monitoring");
  }
  return recommendations;
}

export const DEFAULT_LOOKBACK_DAYS = 30;
