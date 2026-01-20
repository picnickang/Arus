/**
 * Seasonality Analysis Functions for Enhanced Trends Analysis
 */

import { mean } from "simple-statistics";
import type { SeasonalityAnalysis, SeasonalCycle } from "./types";

export function calculateAutocorrelation(values: number[], lag: number): number {
  if (lag >= values.length - 1) { return 0; }

  const n = values.length - lag;
  const mean1 = mean(values.slice(0, n));
  const mean2 = mean(values.slice(lag, lag + n));

  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = values[i] - mean1;
    const diff2 = values[i + lag] - mean2;

    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }

  if (denom1 === 0 || denom2 === 0) { return 0; }
  return numerator / Math.sqrt(denom1 * denom2);
}

export function calculateSeasonalAmplitude(values: number[], period: number): number {
  const segments = Math.floor(values.length / period);
  if (segments < 2) { return 0; }

  const seasonalMeans = [];
  for (let s = 0; s < segments; s++) {
    const segmentStart = s * period;
    const segmentEnd = Math.min((s + 1) * period, values.length);
    const segment = values.slice(segmentStart, segmentEnd);
    seasonalMeans.push(mean(segment));
  }

  const overallMean = mean(seasonalMeans);
  const deviations = seasonalMeans.map((m) => Math.abs(m - overallMean));
  return mean(deviations);
}

export function calculateSeasonalPhase(values: number[], timestamps: Date[], period: number): number {
  const segments = Math.floor(values.length / period);
  if (segments < 2) { return 0; }

  let maxCorr = 0;
  let bestPhase = 0;

  for (let phase = 0; phase < period; phase++) {
    let correlation = 0;
    let count = 0;

    for (let i = phase; i < values.length - period; i += period) {
      if (i + period < values.length) {
        correlation += values[i] * values[i + period];
        count++;
      }
    }

    if (count > 0) {
      correlation /= count;
      if (Math.abs(correlation) > Math.abs(maxCorr)) {
        maxCorr = correlation;
        bestPhase = phase;
      }
    }
  }

  return (bestPhase / period) * 2 * Math.PI;
}

export function analyzeSeasonality(values: number[], timestamps: Date[]): SeasonalityAnalysis {
  const cycles: SeasonalCycle[] = [];

  const testPeriods = [
    { hours: 24, type: "daily" as const },
    { hours: 168, type: "weekly" as const },
    { hours: 8, type: "operational" as const },
    { hours: 720, type: "maintenance" as const },
  ];

  let hasSeasonality = false;
  let dominantPeriod = 0;
  let maxStrength = 0;

  for (const testPeriod of testPeriods) {
    if (values.length < testPeriod.hours * 2) { continue; }

    const autocorr = calculateAutocorrelation(values, Math.floor(testPeriod.hours));
    const strength = Math.abs(autocorr);

    if (strength > 0.3) {
      hasSeasonality = true;

      const amplitude = calculateSeasonalAmplitude(values, testPeriod.hours);
      const phase = calculateSeasonalPhase(values, timestamps, testPeriod.hours);

      cycles.push({
        period: testPeriod.hours,
        amplitude,
        phase,
        strength,
        type: testPeriod.type,
      });

      if (strength > maxStrength) {
        maxStrength = strength;
        dominantPeriod = testPeriod.hours;
      }
    }
  }

  const recommendation = hasSeasonality
    ? `Seasonal patterns detected (${dominantPeriod}h cycle). Consider time-based maintenance scheduling.`
    : "No significant seasonal patterns detected. Equipment operates consistently.";

  return {
    hasSeasonality,
    cycles,
    dominantPeriod,
    strength: maxStrength,
    recommendation,
  };
}
