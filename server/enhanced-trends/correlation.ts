/**
 * Correlation Analysis Functions for Enhanced Trends Analysis
 */

import type { CorrelationAnalysis, LagAnalysisResult } from "./types";
import { calculatePearsonCorrelation, correlationSignificance } from "./statistical-helpers";

export function alignTimeSeries(
  data1: Array<{ timestamp: Date; value: number }>,
  data2: Array<{ timestamp: Date; value: number }>
): Array<{ target: number; sensor: number }> {
  const aligned = [];
  const tolerance = 5 * 60 * 1000; // 5 minute tolerance

  for (const point1 of data1) {
    const closest = data2.find(
      (point2) => Math.abs(point1.timestamp.getTime() - point2.timestamp.getTime()) <= tolerance
    );

    if (closest) {
      aligned.push({
        target: point1.value,
        sensor: closest.value,
      });
    }
  }

  return aligned;
}

export function analyzeLagCorrelation(x: number[], y: number[]): LagAnalysisResult {
  const maxLag = Math.min(10, Math.floor(x.length / 4));
  let maxCorrelation = 0;
  let bestLag = 0;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const start = Math.max(0, -lag);
    const end = Math.min(x.length, x.length - lag);

    if (end > start) {
      const xSubset = x.slice(start, end);
      const ySubset = y.slice(start + lag, end + lag);

      if (xSubset.length === ySubset.length && xSubset.length > 0) {
        const correlation = calculatePearsonCorrelation(xSubset, ySubset);

        if (Math.abs(correlation) > Math.abs(maxCorrelation)) {
          maxCorrelation = correlation;
          bestLag = lag;
        }
      }
    }
  }

  return { lag: bestLag, maxCorrelation };
}

export function classifyRelationship(
  correlation: number
): "positive" | "negative" | "nonlinear" | "none" {
  if (Math.abs(correlation) < 0.1) { return "none"; }
  if (correlation > 0.1) { return "positive"; }
  if (correlation < -0.1) { return "negative"; }
  return "nonlinear";
}

export function classifyCorrelationStrength(
  absCorrelation: number
): "weak" | "moderate" | "strong" | "very_strong" {
  if (absCorrelation < 0.3) { return "weak"; }
  if (absCorrelation < 0.5) { return "moderate"; }
  if (absCorrelation < 0.7) { return "strong"; }
  return "very_strong";
}

export function assessCausality(
  correlation: number,
  significance: number,
  lagAnalysis: LagAnalysisResult
): "none" | "possible" | "likely" | "strong" {
  if (Math.abs(correlation) < 0.3 || significance > 0.05) { return "none"; }
  if (Math.abs(correlation) < 0.5 && lagAnalysis.lag === 0) { return "possible"; }
  if (Math.abs(correlation) >= 0.5 && Math.abs(lagAnalysis.lag) <= 1) { return "likely"; }
  return "strong";
}

export function buildCorrelationAnalysis(
  targetSensor: string,
  sensor: string,
  targetValues: number[],
  sensorValues: number[]
): CorrelationAnalysis | null {
  const correlation = calculatePearsonCorrelation(targetValues, sensorValues);
  const significance = correlationSignificance(correlation, targetValues.length);
  const lagAnalysis = analyzeLagCorrelation(targetValues, sensorValues);

  if (Math.abs(correlation) > 0.2 || significance < 0.05) {
    return {
      targetSensor,
      correlatedSensor: sensor,
      correlation,
      significance,
      lagHours: lagAnalysis.lag,
      relationship: classifyRelationship(correlation),
      strength: classifyCorrelationStrength(Math.abs(correlation)),
      causality: assessCausality(correlation, significance, lagAnalysis),
    };
  }

  return null;
}
