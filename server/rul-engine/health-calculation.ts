/**
 * RUL Engine Health Calculation
 * 
 * Calculates overall equipment health index.
 */

import type { DegradationPattern, ComponentHealthStatus } from "./types.js";

/**
 * Calculate overall equipment health index (0-100)
 */
export function calculateHealthIndex(
  remainingDays: number,
  degradationPattern: DegradationPattern | null,
  componentStatus: ComponentHealthStatus[]
): number {
  // Base health on remaining days (30+ days = 100%, 0 days = 0%)
  let healthIndex = Math.min(100, (remainingDays / 30) * 100);

  // Adjust for component health
  if (componentStatus.length > 0) {
    const avgComponentHealth =
      componentStatus.reduce((sum, c) => sum + c.healthScore, 0) / componentStatus.length;
    healthIndex = healthIndex * 0.6 + avgComponentHealth * 0.4; // Weighted average
  }

  // Penalize for high degradation rate
  if (degradationPattern?.trendSlope > 2) {
    healthIndex *= 0.9; // 10% penalty for rapid degradation
  }

  return Math.max(0, Math.min(100, Math.round(healthIndex)));
}
