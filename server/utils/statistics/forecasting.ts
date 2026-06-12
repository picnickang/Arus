import { linearRegression, exponentialMovingAverage } from "./time-series";

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
  if (values.length === 0) {
    return [];
  }

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
  if (n === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const p = predicted[i];
    if (a === undefined || p === undefined) {
      continue;
    }
    sum += Math.abs(a - p);
  }

  return sum / n;
}

/**
 * Calculate RMSE (Root Mean Square Error)
 */
export function calculateRMSE(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const p = predicted[i];
    if (a === undefined || p === undefined) {
      continue;
    }
    sum += Math.pow(a - p, 2);
  }

  return Math.sqrt(sum / n);
}

/**
 * Calculate MAPE (Mean Absolute Percentage Error)
 */
export function calculateMAPE(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) {
    return 0;
  }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const p = predicted[i];
    if (a === undefined || p === undefined) {
      continue;
    }
    if (a !== 0) {
      sum += Math.abs((a - p) / a);
      count++;
    }
  }

  return count > 0 ? (sum / count) * 100 : 0;
}
