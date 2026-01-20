/**
 * Statistical Analysis Utilities
 *
 * Core statistical functions for trend analysis, seasonality detection,
 * and variability calculations used across ML analytics.
 */

export function calculateTrend(values: number[]): "increasing" | "decreasing" | "stable" {
  if (values.length < 3) { return "stable"; }

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

  const changePercent = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePercent < 5) { return "stable"; }
  return secondAvg > firstAvg ? "increasing" : "decreasing";
}

export function detectSeasonality(values: number[]): boolean {
  if (values.length < 24) { return false; }

  const lag24 = calculateAutocorrelation(values, 24);
  return lag24 > 0.3;
}

export function calculateAutocorrelation(values: number[], lag: number): number {
  if (lag >= values.length) { return 0; }

  const n = values.length - lag;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (values[i] - mean) * (values[i + lag] - mean);
  }

  for (let i = 0; i < values.length; i++) {
    denominator += Math.pow(values[i] - mean, 2);
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

export function calculateVariability(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return mean === 0 ? 0 : Math.sqrt(variance) / Math.abs(mean);
}

export function calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

export function isBadTrendSensor(sensorType: string): boolean {
  return ["temperature", "vibration", "pressure", "current"].includes(sensorType);
}

export function isGoodTrendSensor(sensorType: string): boolean {
  return ["flow_rate", "efficiency", "power_output"].includes(sensorType);
}
