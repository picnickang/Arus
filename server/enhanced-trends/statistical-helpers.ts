/**
 * Statistical Helper Functions for Enhanced Trends Analysis
 */

import { mean, standardDeviation } from "simple-statistics";
import type { StatisticalSummary, TrendResult } from "./types";

export function percentile(sortedValues: number[], pct: number): number {
  const index = (pct / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

export function calculateSkewness(values: number[], meanVal: number, stdDev: number): number {
  const n = values.length;
  const sum = values.reduce((acc, val) => acc + Math.pow((val - meanVal) / stdDev, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

export function calculateKurtosis(values: number[], meanVal: number, stdDev: number): number {
  const n = values.length;
  const sum = values.reduce((acc, val) => acc + Math.pow((val - meanVal) / stdDev, 4), 0);
  return (
    ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum -
    (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
  );
}

export function shapiroWilkTest(values: number[]): { isNormal: boolean; confidence: number } {
  const n = values.length;
  if (n < 8) {
    return { isNormal: false, confidence: 0 };
  }

  const meanVal = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  let withinOneSigma = 0;
  let withinTwoSigma = 0;

  values.forEach((val) => {
    const z = Math.abs((val - meanVal) / stdDev);
    if (z <= 1) {
      withinOneSigma++;
    }
    if (z <= 2) {
      withinTwoSigma++;
    }
  });

  const pctOneSigma = withinOneSigma / n;
  const pctTwoSigma = withinTwoSigma / n;
  const isNormal = pctOneSigma >= 0.6 && pctTwoSigma >= 0.9;
  const confidence = (pctOneSigma + pctTwoSigma) / 2;

  return { isNormal, confidence };
}

export function studentTCDF(t: number, df: number): number {
  return 0.5 + 0.5 * Math.sign(t) * Math.sqrt(1 - Math.exp((-2 * t * t) / Math.PI));
}

export function calculateTrend(values: number[], timestamps: Date[]): TrendResult {
  const n = values.length;
  const x = timestamps.map((_, i) => i);
  const y = values;

  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * (y[i] ?? 0), 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssRes = y.reduce(
    (sum, val, i) => sum + Math.pow(val - (slope * (x[i] ?? 0) + intercept), 2),
    0
  );
  const ssTot = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const tStat = slope / Math.sqrt(ssRes / ((n - 2) * sumXX));
  const pValue = 2 * (1 - studentTCDF(Math.abs(tStat), n - 2));

  let trendType: "increasing" | "decreasing" | "stable" | "volatile";
  if (rSquared < 0.1) {
    trendType = "volatile";
  } else if (Math.abs(slope) < 0.001) {
    trendType = "stable";
  } else if (slope > 0) {
    trendType = "increasing";
  } else {
    trendType = "decreasing";
  }

  return { slope, rSquared, pValue, trendType };
}

export function calculateStatisticalSummary(
  values: number[],
  timestamps: Date[]
): StatisticalSummary {
  const meanValue = mean(values);
  const stdDev = standardDeviation(values);
  const sortedValues = [...values].sort((a, b) => a - b);

  const q1 = percentile(sortedValues, 25);
  const q2 = percentile(sortedValues, 50);
  const q3 = percentile(sortedValues, 75);

  const skewness = calculateSkewness(values, meanValue, stdDev);
  const kurtosis = calculateKurtosis(values, meanValue, stdDev);
  const normalityTest = shapiroWilkTest(values);
  const trendAnalysis = calculateTrend(values, timestamps);

  return {
    count: values.length,
    mean: meanValue,
    median: q2,
    standardDeviation: stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    quartiles: { q1, q2, q3 },
    distribution: {
      skewness,
      kurtosis,
      isNormal: normalityTest.isNormal,
      normalityConfidence: normalityTest.confidence,
    },
    trend: {
      slope: trendAnalysis.slope,
      rSquared: trendAnalysis.rSquared,
      pValue: trendAnalysis.pValue,
      trendType: trendAnalysis.trendType,
    },
  };
}

export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    return 0;
  }

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = (x[i] ?? 0) - meanX;
    const diffY = (y[i] ?? 0) - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  if (denomX === 0 || denomY === 0) {
    return 0;
  }
  return numerator / Math.sqrt(denomX * denomY);
}

export function correlationSignificance(correlation: number, n: number): number {
  if (n < 3) {
    return 1;
  }
  const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
  const df = n - 2;
  return 2 * (1 - studentTCDF(Math.abs(t), df));
}
