/**
 * RUL Engine Constants
 * 
 * Feature flags and configuration for the RUL calculation engine.
 */

// Feature flags for gradual rollout (default: enabled)
export const ENABLE_MODE_AWARE = process.env.RUL_MODE_AWARE !== "false";
export const ENABLE_QUALITY_SCORING = process.env.RUL_QUALITY_SCORING !== "false";
export const ENABLE_REPAIR_CENSORING = process.env.RUL_REPAIR_CENSORING !== "false";
export const ENABLE_CALIBRATION = process.env.RUL_CALIBRATION !== "false";

// Cache configuration
export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Thresholds for data status classification
export const MIN_TELEMETRY_POINTS = 10;
export const STALE_DATA_THRESHOLD_MINS = 1440; // 24 hours
export const LIMITED_DATA_QUALITY_THRESHOLD = 0.5;
export const LIMITED_DATA_POINT_THRESHOLD = 50;
export const LIMITED_DATA_SPAN_DAYS_THRESHOLD = 7;

// Risk level hysteresis buffer
export const RISK_BUFFER = 0.05;

// Degradation analysis thresholds
export const MIN_DEGRADATION_POINTS = 3;
export const CRITICAL_DEGRADATION_THRESHOLD = 100;
