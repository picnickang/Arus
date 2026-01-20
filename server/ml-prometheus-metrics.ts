/**
 * ML Prometheus Metrics - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export {
  mlPredictionTotal, mlPredictionErrors, mlCircuitBreakerTrips,
  mlModelCacheHits, mlModelCacheMisses, mlModelCacheEvictions,
  mlTelemetryReadingsProcessed, mlTelemetryReadingsFiltered, mlModelTrainingTotal,
  mlPredictionDuration, mlModelTrainingDuration,
  technicianInsightDuration, technicianFleetInsightDuration, fleetOverviewResponseTime,
  mlModelAccuracy, mlPredictionConfidence, mlCircuitBreakerState, mlModelCacheSize,
  mlEnsembleAgreement, mlEnsembleModelsUsed, mlFailureProbability, mlDaysToFailure,
  technicianInsightsByStatus,
  technicianInsightGeneration, technicianInsightFallbacks, technicianFleetInsightGeneration,
  fleetOverviewRequests, equipmentDrilldownClicks, healthMonitorPageLoads, healthMonitorEquipmentFilter,
  rulPredictionTotal, rulPredictionDuration, rulDataQuality, rulModeMultiplier,
  rulRepairCensoring, rulCalibrationDelta, rulBaseRateCacheHits, rulBaseRateCacheMisses,
  rulBatchedQueryDuration, rulConfidenceScore, rulRemainingDays,
  recordPrediction, recordPredictionError, recordCircuitBreakerState,
  recordCacheAccess, updateCacheSize, recordEnsemblePrediction,
  recordTechnicianInsight, recordTechnicianInsightFallback,
  updateTechnicianInsightsByStatus, recordFleetTechnicianInsight, recordRulPrediction,
  getMetrics, getMetricsContentType, resetMetrics,
} from "./ml-prometheus-metrics/index.js";
