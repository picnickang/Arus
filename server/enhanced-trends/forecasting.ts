/**
 * Forecasting Functions for Enhanced Trends Analysis
 */

import { mean, standardDeviation } from "simple-statistics";
import type { ForecastingResult, ForecastPoint, ForecastOutput } from "./types";
import { calculateTrend } from "./statistical-helpers";
import { analyzeSeasonality } from "./seasonality";

export function linearForecast(
  values: number[],
  timestamps: Date[],
  hours: number
): ForecastOutput {
  const trend = calculateTrend(values, timestamps);
  const predictions: ForecastPoint[] = [];

  const lastTs = timestamps[timestamps.length - 1];
  if (!lastTs) {
    return {
      predictions,
      confidence: 0,
      metrics: { mae: 0, rmse: 0, mape: 0 },
    };
  }
  const lastTimestamp = lastTs.getTime();
  const meanValue = mean(values);
  const stdDev = standardDeviation(values);

  for (let h = 1; h <= hours; h++) {
    const futureTimestamp = new Date(lastTimestamp + h * 60 * 60 * 1000);
    const predictedValue = meanValue + trend.slope * (timestamps.length + h - 1);
    const margin = 1.96 * stdDev;

    predictions.push({
      timestamp: futureTimestamp,
      predictedValue,
      confidenceInterval: {
        lower: predictedValue - margin,
        upper: predictedValue + margin,
      },
      probability: Math.max(0.5, trend.rSquared),
    });
  }

  const mae = stdDev * 0.8;
  const rmse = stdDev;
  const mape = meanValue !== 0 ? (stdDev / Math.abs(meanValue)) * 100 : 0;

  return {
    predictions,
    confidence: trend.rSquared,
    metrics: { mae, rmse, mape },
  };
}

export function exponentialSmoothing(
  values: number[],
  timestamps: Date[],
  hours: number
): ForecastOutput {
  const alpha = 0.3;
  const predictions: ForecastPoint[] = [];

  const firstValue = values[0];
  const lastTs = timestamps[timestamps.length - 1];
  if (firstValue === undefined || !lastTs) {
    return {
      predictions,
      confidence: 0,
      metrics: { mae: 0, rmse: 0, mape: 0 },
    };
  }
  const smoothed: number[] = [firstValue];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    const prev = smoothed[i - 1];
    if (v === undefined || prev === undefined) {continue;}
    smoothed[i] = alpha * v + (1 - alpha) * prev;
  }

  const lastSmoothed = smoothed[smoothed.length - 1] ?? firstValue;
  const lastTimestamp = lastTs.getTime();

  const residuals = values.map((val, i) => Math.abs(val - (smoothed[i] ?? val)));
  const meanAbsoluteError = mean(residuals);

  for (let h = 1; h <= hours; h++) {
    const futureTimestamp = new Date(lastTimestamp + h * 60 * 60 * 1000);
    const margin = 1.96 * meanAbsoluteError;

    predictions.push({
      timestamp: futureTimestamp,
      predictedValue: lastSmoothed,
      confidenceInterval: {
        lower: lastSmoothed - margin,
        upper: lastSmoothed + margin,
      },
      probability: 0.75,
    });
  }

  const meanAbsValues = mean(values.map(Math.abs));

  return {
    predictions,
    confidence: 0.75,
    metrics: {
      mae: meanAbsoluteError,
      rmse: Math.sqrt(mean(residuals.map((r) => r * r))),
      mape: meanAbsValues !== 0 ? (meanAbsoluteError / meanAbsValues) * 100 : 0,
    },
  };
}

export function seasonalForecast(
  values: number[],
  timestamps: Date[],
  hours: number
): ForecastOutput {
  const seasonality = analyzeSeasonality(values, timestamps);

  if (!seasonality.hasSeasonality || seasonality.cycles.length === 0) {
    return linearForecast(values, timestamps, hours);
  }

  const dominantCycle = seasonality.cycles[0];
  const lastTs = timestamps[timestamps.length - 1];
  if (!dominantCycle || !lastTs) {
    return linearForecast(values, timestamps, hours);
  }
  const period = dominantCycle.period;
  const predictions: ForecastPoint[] = [];
  const lastTimestamp = lastTs.getTime();

  const meanValue = mean(values);
  const trend = calculateTrend(values, timestamps);

  for (let h = 1; h <= hours; h++) {
    const futureTimestamp = new Date(lastTimestamp + h * 60 * 60 * 1000);

    const seasonalPhase = ((h % period) / period) * 2 * Math.PI;
    const seasonalComponent =
      dominantCycle.amplitude * Math.cos(seasonalPhase + dominantCycle.phase);
    const trendComponent = trend.slope * (timestamps.length + h - 1);

    const predictedValue = meanValue + trendComponent + seasonalComponent;
    const margin = dominantCycle.amplitude * 1.5;

    predictions.push({
      timestamp: futureTimestamp,
      predictedValue,
      confidenceInterval: {
        lower: predictedValue - margin,
        upper: predictedValue + margin,
      },
      probability: dominantCycle.strength,
    });
  }

  return {
    predictions,
    confidence: dominantCycle.strength,
    metrics: {
      mae: dominantCycle.amplitude * 0.5,
      rmse: dominantCycle.amplitude * 0.7,
      mape: meanValue !== 0 ? (dominantCycle.amplitude / Math.abs(meanValue)) * 100 : 0,
    },
  };
}

export function selectBestForecastMethod(
  values: number[],
  timestamps: Date[]
): "linear" | "seasonal" | "exponential" {
  const seasonality = analyzeSeasonality(values, timestamps);
  const trend = calculateTrend(values, timestamps);

  if (seasonality.hasSeasonality && seasonality.strength > 0.4) {
    return "seasonal";
  }
  if (trend.rSquared > 0.3) {
    return "linear";
  }
  return "exponential";
}

export function generateForecastRecommendation(confidence: number): string {
  if (confidence > 0.8) {
    return `High confidence forecast (${(confidence * 100).toFixed(1)}%). Suitable for proactive maintenance planning.`;
  }
  if (confidence > 0.6) {
    return `Moderate confidence forecast (${(confidence * 100).toFixed(1)}%). Use for trend awareness, validate with additional sensors.`;
  }
  return `Low confidence forecast (${(confidence * 100).toFixed(1)}%). Equipment behavior is unpredictable, increase monitoring frequency.`;
}

const forecastMethods: Record<
  string,
  (values: number[], timestamps: Date[], horizon: number) => ForecastOutput
> = {
  linear: linearForecast,
  exponential: exponentialSmoothing,
  seasonal: seasonalForecast,
};

export function performForecasting(values: number[], timestamps: Date[]): ForecastingResult {
  const forecastHorizon = 24;
  const bestMethod = selectBestForecastMethod(values, timestamps);
  const forecastFn = forecastMethods[bestMethod] ?? linearForecast;
  const selectedForecast = forecastFn(values, timestamps, forecastHorizon);

  return {
    method: bestMethod,
    predictions: selectedForecast.predictions,
    confidence: selectedForecast.confidence,
    horizon: forecastHorizon,
    metrics: selectedForecast.metrics,
    recommendation: generateForecastRecommendation(selectedForecast.confidence),
  };
}
