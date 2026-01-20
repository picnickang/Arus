/**
 * RUL Engine Risk Assessment
 * 
 * Determines risk levels and failure probabilities based on RUL analysis.
 */

import type { DegradationPattern } from "./types.js";
import { RISK_BUFFER } from "./constants.js";

/**
 * Determine risk level based on RUL and failure probability with hysteresis
 * Prevents state flapping by adding buffer zones to individual thresholds
 * Preserves OR-based escalation (any critical factor triggers critical risk)
 */
export function determineRiskLevel(
  remainingDays: number,
  failureProbability: number,
  healthIndex: number
): "low" | "medium" | "high" | "critical" {
  // Critical: Any single severe indicator escalates to critical
  // Buffers extend the critical range slightly to prevent flapping back to high
  if (
    failureProbability > 0.7 - RISK_BUFFER || // 0.65+ triggers critical
    remainingDays < 7 + 2 || // <9 days triggers critical
    healthIndex < 30 + 5 // <35 triggers critical
  ) {
    return "critical";
  }

  // High: Moderate indicators
  // Buffers extend the high range to prevent flapping back to medium
  if (
    failureProbability > 0.4 - RISK_BUFFER || // 0.35+ triggers high
    remainingDays < 21 + 2 || // <23 days triggers high
    healthIndex < 60 + 5 // <65 triggers high
  ) {
    return "high";
  }

  // Medium: Some risk present
  // Buffers extend the medium range to prevent flapping back to low
  if (
    failureProbability > 0.2 - RISK_BUFFER || // 0.15+ triggers medium
    remainingDays < 35 + 2 || // <37 days triggers medium
    healthIndex < 80 + 5 // <85 triggers medium
  ) {
    return "medium";
  }

  // Low: Minimal risk
  return "low";
}

/**
 * Estimate failure probability from degradation pattern
 */
export function estimateFailureProbability(pattern: DegradationPattern | null): number {
  if (!pattern || pattern.timeToFailure <= 0) {return 0.05;}

  // Higher probability as time to failure decreases
  const timeFactor = Math.max(0, 1 - pattern.timeToFailure / 60);

  // Higher probability with higher degradation rate
  const rateFactor = Math.min(1, pattern.trendSlope / 5);

  // Higher probability with acceleration
  const accelFactor = Math.min(0.3, Math.abs(pattern.acceleration) / 10);

  const probability = timeFactor * 0.5 + rateFactor * 0.3 + accelFactor * 0.2;

  return Math.min(0.95, Math.max(0.05, probability));
}
