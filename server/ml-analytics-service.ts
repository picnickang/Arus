/**
 * ML Analytics Service - Backward Compatibility Shim
 *
 * This file maintains backward compatibility with existing imports.
 * The actual implementation has been modularized into server/ml-analytics/
 *
 * @see server/ml-analytics/index.ts - Main service class
 * @see server/ml-analytics/anomaly-detection.ts - Anomaly detection logic
 * @see server/ml-analytics/failure-prediction.ts - Failure prediction
 * @see server/ml-analytics/statistical.ts - Statistical utilities
 * @see server/ml-analytics/database.ts - Database operations
 * @see server/ml-analytics/types.ts - Type definitions
 */

export {
  MLAnalyticsService,
  mlAnalyticsService,
  type AnomalyResult,
  type FailurePredictionResult,
  type StatisticalBaseline,
} from "./ml-analytics";
