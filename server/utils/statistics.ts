/**
 * Consolidated Statistical Utilities
 *
 * Centralized collection of statistical analysis functions used across:
 * - Enhanced trends analysis
 * - PdM feature extraction
 * - Sensor optimization
 * - Weibull RUL analysis
 *
 * Prevents code duplication and ensures consistent calculations
 */

import { mean, standardDeviation, quantile } from "simple-statistics";

export * from "./statistics/signal";
export * from "./statistics/time-series";
export * from "./statistics/forecasting";

// ============================================================================
// BASIC STATISTICS
// ============================================================================

/**
 * Calculate basic statistical summary
 */
export function calculateSummaryStats(values: number[]) {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      std: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  // values.length > 0 verified above, so sorted is non-empty; defaults are unreachable.
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  return {
    count: values.length,
    mean: mean(values),
    median,
    std: standardDeviation(values),
    min,
    max,
  };
}

/**
 * Calculate percentile (0-1 scale)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  return quantile(values, p);
}

/**
 * Calculate standard deviation
 */
export function calculateStd(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const avg = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// ============================================================================
// DISTRIBUTION ANALYSIS
// ============================================================================

/**
 * Calculate Kurtosis (measure of distribution "tailedness")
 * Indicates spiky vs smooth signals - useful for fault detection
 */
export function calculateKurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) {
    return 0;
  }

  const avg = mean(values);
  const std = standardDeviation(values) || 1e-9; // prevent division by zero

  const m4 =
    values.reduce((sum, val) => {
      return sum + Math.pow((val - avg) / std, 4);
    }, 0) / n;

  return m4 - 3; // Excess kurtosis (normal distribution = 0)
}

/**
 * Calculate Skewness (measure of distribution asymmetry)
 */
export function calculateSkewness(values: number[]): number {
  const n = values.length;
  if (n < 3) {
    return 0;
  }

  const avg = mean(values);
  const std = standardDeviation(values) || 1e-9;

  return (
    values.reduce((sum, val) => {
      return sum + Math.pow((val - avg) / std, 3);
    }, 0) / n
  );
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Detect anomalies using IQR (Interquartile Range) method
 */
export function detectIQRAnomalies(values: number[], multiplier: number = 1.5) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return values.map((value, index) => ({
    index,
    value,
    isAnomaly: value < lowerBound || value > upperBound,
    deviation:
      value < lowerBound ? lowerBound - value : value > upperBound ? value - upperBound : 0,
    lowerBound,
    upperBound,
  }));
}

/**
 * Detect anomalies using Z-score method
 */
export function detectZScoreAnomalies(values: number[], threshold: number = 3) {
  const avg = mean(values);
  const std = standardDeviation(values) || 1e-9;

  return values.map((value, index) => {
    const zScore = Math.abs((value - avg) / std);
    return {
      index,
      value,
      zScore,
      isAnomaly: zScore > threshold,
      deviation: Math.abs(value - avg),
    };
  });
}

/**
 * Calculate Z-score for a single value against a baseline
 */
export function zScore(value: number, baseline: number, baselineStd: number): number {
  if (baselineStd === 0) {
    return 0;
  }
  return (value - baseline) / baselineStd;
}

/**
 * Clamp Z-score to reasonable bounds to prevent numerical issues
 */
export function clampSigma(z: number): number {
  if (!Number.isFinite(z)) {
    return 0;
  }
  return Math.max(-10, Math.min(10, z));
}

// ============================================================================
// NORMALITY TESTING
// ============================================================================

/**
 * Simplified Shapiro-Wilk test for normality
 * Returns whether distribution is approximately normal
 */
export function shapiroWilkTest(values: number[]): { isNormal: boolean; confidence: number } {
  const n = values.length;
  if (n < 3) {
    return { isNormal: true, confidence: 0 };
  }

  // Calculate skewness and kurtosis
  const skew = calculateSkewness(values);
  const kurt = calculateKurtosis(values);

  // Normal distribution has skewness ~ 0 and kurtosis ~ 0 (excess)
  const skewDev = Math.abs(skew);
  const kurtDev = Math.abs(kurt);

  // Simple threshold-based test
  const isNormal = skewDev < 1 && kurtDev < 3;

  // Confidence based on how close to normal
  const skewScore = Math.max(0, 1 - skewDev / 2);
  const kurtScore = Math.max(0, 1 - kurtDev / 6);
  const confidence = (skewScore + kurtScore) / 2;

  return { isNormal, confidence };
}
