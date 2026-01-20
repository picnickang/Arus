/**
 * RUL Engine Data Status
 * 
 * Determines data status for ML governance transparency.
 * CRITICAL: Prevents conflating "no data" with "low risk"
 */

import type { DataStatusResult } from "./types.js";
import {
  MIN_TELEMETRY_POINTS,
  STALE_DATA_THRESHOLD_MINS,
  LIMITED_DATA_QUALITY_THRESHOLD,
  LIMITED_DATA_POINT_THRESHOLD,
  LIMITED_DATA_SPAN_DAYS_THRESHOLD,
} from "./constants.js";

/**
 * Determine data status for transparency
 * 
 * Thresholds:
 * - no_data: <10 telemetry points OR <1 day span
 * - stale_data: staleness > 24 hours (1440 mins)
 * - limited_data: dataQuality < 0.5 OR <50 points
 * - sufficient_data: dataQuality >= 0.5 AND adequate coverage
 */
export function determineDataStatus(
  telemetryCount: number,
  spanDays: number,
  stalenessMins: number,
  dataQuality: number,
  mlPredictionCount: number,
  degradationPointCount: number
): DataStatusResult {
  // No data: Insufficient telemetry to make any prediction
  if (telemetryCount < MIN_TELEMETRY_POINTS && mlPredictionCount === 0 && degradationPointCount < 3) {
    return {
      dataStatus: "no_data",
      dataStatusReason: `Insufficient telemetry data (${telemetryCount} points). At least ${MIN_TELEMETRY_POINTS} data points required for reliable predictions.`,
    };
  }

  // Stale data: Data exists but is too old for reliable prediction
  if (stalenessMins > STALE_DATA_THRESHOLD_MINS) {
    const hoursStale = Math.round(stalenessMins / 60);
    return {
      dataStatus: "stale_data",
      dataStatusReason: `Telemetry data is ${hoursStale} hours old. Real-time or recent data (< 24 hours) required for reliable predictions.`,
    };
  }

  // Limited data: Some data but below ideal thresholds
  if (
    dataQuality < LIMITED_DATA_QUALITY_THRESHOLD || 
    telemetryCount < LIMITED_DATA_POINT_THRESHOLD || 
    spanDays < LIMITED_DATA_SPAN_DAYS_THRESHOLD
  ) {
    const issues: string[] = [];
    if (dataQuality < LIMITED_DATA_QUALITY_THRESHOLD) {
      issues.push(`low quality score (${(dataQuality * 100).toFixed(0)}%)`);
    }

    if (telemetryCount < LIMITED_DATA_POINT_THRESHOLD) {
      issues.push(`limited data points (${telemetryCount})`);
    }

    if (spanDays < LIMITED_DATA_SPAN_DAYS_THRESHOLD) {
      issues.push(`short monitoring period (${spanDays.toFixed(1)} days)`);
    }
    
    return {
      dataStatus: "limited_data",
      dataStatusReason: `Prediction confidence reduced due to: ${issues.join(", ")}. Results should be validated with additional inspection.`,
    };
  }

  // Sufficient data: Good quality and coverage
  return {
    dataStatus: "sufficient_data",
    dataStatusReason: `Adequate telemetry data (${telemetryCount} points over ${spanDays.toFixed(1)} days) with ${(dataQuality * 100).toFixed(0)}% quality score.`,
  };
}
