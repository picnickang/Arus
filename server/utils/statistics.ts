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

export type Series = number[];

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

  return {
    count: values.length,
    mean: mean(values),
    median: sorted[Math.floor(sorted.length / 2)],
    std: standardDeviation(values),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Calculate percentile (0-1 scale)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) { return 0; }
  return quantile(values, p);
}

/**
 * Calculate standard deviation
 */
export function calculateStd(values: number[]): number {
  if (values.length === 0) { return 0; }
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
  if (n < 4) { return 0; }

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
  if (n < 3) { return 0; }

  const avg = mean(values);
  const std = standardDeviation(values) || 1e-9;

  return values.reduce((sum, val) => {
      return sum + Math.pow((val - avg) / std, 3);
    }, 0) / n;
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
  if (baselineStd === 0) { return 0; }
  return (value - baseline) / baselineStd;
}

/**
 * Clamp Z-score to reasonable bounds to prevent numerical issues
 */
export function clampSigma(z: number): number {
  if (!Number.isFinite(z)) { return 0; }
  return Math.max(-10, Math.min(10, z));
}

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

/**
 * Calculate RMS (Root Mean Square)
 * Standard measure for vibration analysis
 */
export function calculateRMS(values: number[]): number {
  if (values.length === 0) { return 0; }
  const sumOfSquares = values.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumOfSquares / values.length);
}

/**
 * Absolute Envelope - Fast rectified envelope proxy for bearing fault detection
 * Detects impulse patterns typical in bearing defects
 */
export function absEnvelope(x: Series, windowSize: number = 5): number[] {
  if (!x.length) { return []; }

  const rectified = x.map((val) => Math.abs(val));
  const envelope: number[] = [];

  for (let i = 0; i < rectified.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j >= 0 && j < rectified.length) {
        sum += rectified[j];
        count++;
      }
    }

    envelope.push(sum / Math.max(1, count));
  }

  return envelope;
}

/**
 * Band RMS Analysis - Frequency domain energy in specific bands
 * Critical for ISO 10816 compliance and fault frequency analysis
 */
export function bandRMS(
  freq: number[],
  mag: number[],
  bands: { lo: number; hi: number; name: string }[]
): { name: string; value: number }[] {
  return bands.map((band) => {
    let energySum = 0;
    let count = 0;

    for (let i = 0; i < freq.length; i++) {
      const f = freq[i];
      if (f >= band.lo && f < band.hi) {
        const magnitude = mag[i] || 0;
        energySum += magnitude * magnitude;
        count++;
      }
    }

    return {
      name: band.name,
      value: Math.sqrt(energySum / Math.max(1, count)),
    };
  });
}

// ============================================================================
// TIME SERIES ANALYSIS
// ============================================================================

/**
 * Linear regression for trend analysis
 */
export function linearRegression(x: number[], y: number[]) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const rSquared = 1 - ssResidual / ssTotal;

  return { slope, intercept, rSquared };
}

/**
 * Moving average (simple)
 */
export function movingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(mean(window));
  }
  return result;
}

/**
 * Exponential moving average
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) { return []; }

  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * Calculate autocorrelation at a specific lag
 */
export function calculateAutocorrelation(values: number[], lag: number): number {
  const n = values.length;
  if (lag >= n || lag < 0) { return 0; }

  const meanVal = mean(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n - lag; i++) {
    numerator += (values[i] - meanVal) * (values[i + lag] - meanVal);
  }

  for (let i = 0; i < n; i++) {
    denominator += Math.pow(values[i] - meanVal, 2);
  }

  return denominator !== 0 ? numerator / denominator : 0;
}

// ============================================================================
// CORRELATION ANALYSIS
// ============================================================================

/**
 * Calculate Pearson correlation coefficient between two series
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) { return 0; }

  const meanX = mean(x.slice(0, n));
  const meanY = mean(y.slice(0, n));

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Classify correlation strength
 */
export function classifyCorrelationStrength(
  correlation: number
): "none" | "weak" | "moderate" | "strong" | "very-strong" {
  const abs = Math.abs(correlation);
  if (abs < 0.2) { return "none"; }
  if (abs < 0.4) { return "weak"; }
  if (abs < 0.6) { return "moderate"; }
  if (abs < 0.8) { return "strong"; }
  return "very-strong";
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
  if (n < 3) { return { isNormal: true, confidence: 0 }; }

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

// ============================================================================
// FORECASTING
// ============================================================================

/**
 * Simple linear forecast
 */
export function linearForecast(values: number[], steps: number): number[] {
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const { slope, intercept } = linearRegression(x, values);

  const forecast: number[] = [];
  for (let i = 0; i < steps; i++) {
    forecast.push(slope * (n + i) + intercept);
  }

  return forecast;
}

/**
 * Exponential smoothing forecast
 */
export function exponentialSmoothing(values: number[], alpha: number, steps: number): number[] {
  if (values.length === 0) { return []; }

  const smoothed = exponentialMovingAverage(values, alpha);
  const lastValue = smoothed[smoothed.length - 1];

  // Simple forecast: repeat last smoothed value
  return Array(steps).fill(lastValue);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate MAE (Mean Absolute Error)
 */
export function calculateMAE(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) { return 0; }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(actual[i] - predicted[i]);
  }

  return sum / n;
}

/**
 * Calculate RMSE (Root Mean Square Error)
 */
export function calculateRMSE(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) { return 0; }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.pow(actual[i] - predicted[i], 2);
  }

  return Math.sqrt(sum / n);
}

/**
 * Calculate MAPE (Mean Absolute Percentage Error)
 */
export function calculateMAPE(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) { return 0; }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    if (actual[i] !== 0) {
      sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
      count++;
    }
  }

  return count > 0 ? (sum / count) * 100 : 0;
}
