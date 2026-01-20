/**
 * ML Ensemble Helpers
 * 
 * Statistical and recommendation utilities for ensemble predictions.
 */

import type { StatsResult } from "./types.js";

/**
 * Calculate statistical features from values
 */
export function calculateStats(values: number[]): StatsResult {
  const validValues = values.filter((v) => Number.isFinite(v));

  if (validValues.length === 0) {
    return { avg: 0, max: 0, min: 0, std: 0 };
  }

  const avg = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
  const max = Math.max(...validValues);
  const min = Math.min(...validValues);

  const variance =
    validValues.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / validValues.length;
  const std = Math.sqrt(variance);

  return { avg, max, min, std };
}

/**
 * Calculate model agreement score
 * Higher score means models agree more (more confident prediction)
 */
export function calculateAgreement(predictions: number[]): number {
  if (predictions.length < 2) { return 1; }

  const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
  const variance =
    predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
  const stdDev = Math.sqrt(variance);

  return Math.max(0, 1 - stdDev * 2);
}

/**
 * Generate recommendations based on ensemble prediction
 */
export function generateRecommendations(
  prediction: number,
  confidence: number,
  agreement: number,
  _equipmentType: string
): string[] {
  const recommendations: string[] = [];

  if (prediction > 0.7 && confidence > 0.7) {
    recommendations.push("HIGH RISK: Schedule immediate inspection", "Review recent maintenance history", "Prepare replacement parts");
  } else if (prediction > 0.5 && confidence > 0.6) {
    recommendations.push("MODERATE RISK: Schedule preventive maintenance within 7 days", "Monitor telemetry closely");
  } else if (prediction > 0.3) {
    recommendations.push("LOW RISK: Continue normal monitoring", "Schedule routine maintenance as planned");
  }

  if (agreement < 0.6) {
    recommendations.push("⚠️ Models disagree - collect more data for this equipment type");
  }

  if (confidence < 0.5) {
    recommendations.push("⚠️ Low confidence - prediction may be unreliable");
  }

  return recommendations;
}
