import { mean } from "simple-statistics";

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
  const sumXY = x.reduce((sum, xi, i) => {
    const yi = y[i];
    return yi === undefined ? sum : sum + xi * yi;
  }, 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => {
    const xi = x[i];
    if (xi === undefined) {
      return sum;
    }
    const predicted = slope * xi + intercept;
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
  if (values.length === 0) {
    return [];
  }

  const first = values[0];
  if (first === undefined) {
    return [];
  }
  const result: number[] = [first];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    const prev = result[i - 1];
    if (v === undefined || prev === undefined) {
      continue;
    }
    result.push(alpha * v + (1 - alpha) * prev);
  }
  return result;
}

/**
 * Calculate autocorrelation at a specific lag
 */
export function calculateAutocorrelation(values: number[], lag: number): number {
  const n = values.length;
  if (lag >= n || lag < 0) {
    return 0;
  }

  const meanVal = mean(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n - lag; i++) {
    const vi = values[i];
    const vil = values[i + lag];
    if (vi === undefined || vil === undefined) {
      continue;
    }
    numerator += (vi - meanVal) * (vil - meanVal);
  }

  for (let i = 0; i < n; i++) {
    const vi = values[i];
    if (vi === undefined) {
      continue;
    }
    denominator += Math.pow(vi - meanVal, 2);
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
  if (n === 0) {
    return 0;
  }

  const meanX = mean(x.slice(0, n));
  const meanY = mean(y.slice(0, n));

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    if (xi === undefined || yi === undefined) {
      continue;
    }
    const dx = xi - meanX;
    const dy = yi - meanY;
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
  if (abs < 0.2) {
    return "none";
  }
  if (abs < 0.4) {
    return "weak";
  }
  if (abs < 0.6) {
    return "moderate";
  }
  if (abs < 0.8) {
    return "strong";
  }
  return "very-strong";
}
