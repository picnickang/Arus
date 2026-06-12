/**
 * Observability Module Aggregator
 *
 * This module re-exports all observability metrics and functions from domain-specific modules.
 * Total: ~1,567 lines modularized into 16 domain-specific files.
 *
 * Modules:
 * - core-metrics: Event loop, database, memory monitoring
 * - http-metrics: HTTP request metrics and middleware
 * - performance-tracking: Performance tracking utilities
 * - websocket-metrics: WebSocket connection metrics
 * - equipment-metrics: Equipment, fleet health, work order metrics
 * - alert-metrics: Alert system metrics
 * - mqtt-metrics: MQTT reliable sync metrics
 * - security-metrics: Tenant isolation and auth metrics
 * - ml-metrics: ML prediction metrics
 * - hub-sync-metrics: Hub/sync/sheet metrics
 * - rag-metrics: RAG/knowledge base metrics
 * - job-queue-metrics: Job queue metrics
 * - reconciliation-metrics: Data reconciliation metrics
 * - telemetry-ingestion-metrics: Telemetry processing metrics
 * - circuit-breaker-metrics: External circuit breaker metrics
 * - health-endpoints: Health check endpoints
 * - initialization: Metrics initialization
 *
 * Pre-existing modules (already modularized):
 * - inventory-metrics: Advanced inventory management metrics
 * - optimizer-metrics: LP optimizer metrics
 * - scheduler-metrics: Scheduler metrics
 * - telemetry-metrics: Telemetry metrics (additional)
 */

// Core metrics
export {
  eventLoopLag,
  eventLoopLagCurrent,
  startEventLoopMonitoring,
  stopEventLoopMonitoring,
  databaseConnectionsTotal,
  databaseQueryDuration,
  databaseErrorsTotal,
  rangeQueriesTotal,
  rangeQueryDuration,
  PERFORMANCE_THRESHOLDS,
  checkResourceUsage,
  MEMORY_CHECK_INTERVAL,
  // Backward-compatible aliases
  recordDatabaseQuery,
  incrementDatabaseError,
  incrementRangeQuery,
  recordRangeQueryDuration,
} from "./core-metrics";

// HTTP metrics and middleware
export {
  httpRequestsTotal,
  httpRequestDuration,
  horImportTotal,
  horComplianceChecksTotal,
  horPdfExportsTotal,
  idempotencyHitsTotal,
  metricsMiddleware,
  recordHorImport,
  recordHorComplianceCheck,
  recordHorPdfExport,
  recordIdempotencyHit,
  // Backward-compatible aliases
  incrementHorImport,
  incrementHorComplianceCheck,
  incrementHorPdfExport,
  incrementIdempotencyHit,
} from "./http-metrics";

// Performance tracking
export { trackPerformance, trackDatabaseQuery, trackBatchOperation } from "./performance-tracking";

// WebSocket metrics
export {
  websocketConnectionsTotal,
  websocketMessagesTotal,
  websocketReconnectionsTotal,
  recordWebsocketConnection,
  recordWebsocketMessage,
  recordWebsocketReconnection,
  // Backward-compatible aliases
  setWebSocketConnections,
  incrementWebSocketMessage,
  incrementWebSocketReconnection,
} from "./websocket-metrics";

// Equipment and fleet metrics
export {
  equipmentHealthStatus,
  fleetHealthScore,
  pdmScoresTotal,
  maintenanceSchedulesTotal,
  vesselOperationsTotal,
  workOrdersTotal,
  recordEquipmentHealth,
  recordFleetHealth,
  recordPdmScore,
  recordMaintenanceSchedule,
  recordVesselOperation,
  recordWorkOrder,
  // Backward-compatible aliases
  updateEquipmentHealthStatus,
  updateFleetHealthScore,
  incrementWorkOrder,
  incrementMaintenanceSchedule,
  incrementVesselOperation,
} from "./equipment-metrics";

// Alert metrics
export {
  alertsGeneratedTotal,
  alertsAcknowledgedTotal,
  alertConfigurationsTotal,
  recordAlertGenerated,
  recordAlertAcknowledged,
  setAlertConfigurationsCount,
  // Backward-compatible aliases
  incrementAlertGenerated,
  incrementAlertAcknowledged,
} from "./alert-metrics";

// MQTT metrics
export {
  mqttMessagesPublishedTotal,
  mqttMessagesQueuedTotal,
  mqttMessagesDroppedTotal,
  mqttPublishFailuresTotal,
  mqttReconnectionAttemptsTotal,
  mqttQueueFlushesTotal,
  mqttQueueDepthGauge,
  mqttQueueUtilizationGauge,
  mqttConnectionStatusGauge,
  recordMqttPublish,
  recordMqttQueued,
  recordMqttDropped,
  recordMqttFailure,
  recordMqttReconnection,
  recordMqttQueueFlush,
  setMqttQueueDepth,
  setMqttQueueUtilization,
  setMqttConnectionStatus,
  updateMqttMetrics,
} from "./mqtt-metrics";

// Security metrics
export {
  tenantIsolationDeniedTotal,
  authFailureTotal,
  crossOrgAccessBlockedTotal,
  suspiciousOrgIdRejectedTotal,
  forbiddenOrgIdBlockedTotal,
  recordTenantIsolationDenied,
  recordAuthFailure,
  recordSuspiciousOrgId,
  recordForbiddenOrgIdBlocked,
} from "./security-metrics";

// ML metrics
export {
  mlPredictionDuration,
  mlPredictionTotal,
  mlPredictionConfidence,
  mlModelCacheHits,
  mlModelCacheMisses,
  mlCircuitBreakerState,
  mlSemaphoreWaitTime,
  recordMlPredictionDuration,
  recordMlPrediction,
  recordMlPredictionConfidence,
  recordMlModelCacheHit,
  recordMlModelCacheMiss,
  setMlCircuitBreakerState,
  recordMlSemaphoreWait,
} from "./ml-metrics";

// Hub sync metrics
export {
  deviceRegistryOperationsTotal,
  deviceRegistryActiveDevices,
  sheetLockOperationsTotal,
  sheetLocksActive,
  sheetVersionOperationsTotal,
  sheetVersionsTotal,
  replayOperationsTotal,
  replayDuplicatesTotal,
  recordDeviceRegistryOperation,
  setActiveDeviceCount,
  recordSheetLockOperation,
  setActiveSheetLocks,
  recordSheetVersionOperation,
  setSheetVersionsCount,
  recordReplayOperation,
  recordReplayDuplicate,
} from "./hub-sync-metrics";

// RAG metrics
export {
  kbDocumentsUploadedTotal,
  kbUploadBytesTotal,
  kbUploadInflight,
  kbEmbeddingDuration,
  kbChunksProcessedTotal,
  kbSearchDuration,
  kbSearchTotal,
  kbSearchResultsCount,
  kbEmbeddingCacheHitsTotal,
  kbEmbeddingCacheMissesTotal,
  kbEmbeddingCacheSize,
  kbVectorIndexBuildDuration,
  kbVectorIndexRebuildTotal,
  kbVectorIndexLastLatency,
  kbVectorIndexRowCount,
  recordKbDocumentUpload,
  recordKbUploadBytes,
  setKbUploadInflight,
  recordKbEmbeddingDuration,
  recordKbChunkProcessed,
  recordKbSearchDuration,
  recordKbSearch,
  recordKbSearchResults,
  recordKbEmbeddingCacheHit,
  recordKbEmbeddingCacheMiss,
  setKbEmbeddingCacheSize,
  recordKbVectorIndexBuild,
  recordKbVectorIndexRebuild,
  setKbVectorIndexLatency,
  setKbVectorIndexRowCount,
  incrementKbDocumentsUploaded,
  incrementKbUploadBytes,
  incrementKbUploadInflight,
  decrementKbUploadInflight,
} from "./rag-metrics";

// Job queue metrics
export {
  jobQueueJobsEnqueuedTotal,
  // Backward-compatible aliases
  incrementJobEnqueued,
  incrementJobCompleted,
  incrementJobFailed,
  setJobQueueSize,
  jobQueueJobsCompletedTotal,
  jobQueueJobsFailedTotal,
  jobQueueJobDuration,
  jobQueueDepth,
  jobQueueWorkerUtilization,
  recordJobEnqueued,
  recordJobCompleted,
  recordJobFailed,
  recordJobDuration,
  setJobQueueDepth,
  setWorkerUtilization,
} from "./job-queue-metrics";

// Reconciliation metrics
export {
  reconciliationRunsTotal,
  reconciliationDuration,
  reconciliationDiscrepanciesFound,
  reconciliationDiscrepanciesFixed,
  dataQualityScore,
  recordReconciliationRun,
  recordReconciliationDuration,
  setReconciliationDiscrepancies,
  recordReconciliationFix,
  setDataQualityScore,
} from "./reconciliation-metrics";

// Telemetry ingestion metrics
export {
  telemetryProcessedTotal,
  telemetryErrorsTotal,
  telemetryBatchSize,
  telemetryIngestionLatency,
  telemetryBufferUtilization,
  telemetryDroppedTotal,
  recordTelemetryProcessed,
  recordTelemetryError,
  recordTelemetryBatch,
  recordTelemetryIngestionLatency,
  setTelemetryBufferUtilization,
  recordTelemetryDropped,
  // Backward-compatible aliases
  incrementTelemetryProcessed,
  incrementTelemetryError,
} from "./telemetry-ingestion-metrics";

// Circuit breaker metrics
export {
  externalCircuitBreakerState,
  externalCircuitBreakerFailures,
  externalServiceLatency,
  externalServiceCallsTotal,
  dependencyHealthStatus,
  setExternalCircuitBreakerState,
  recordExternalCircuitBreakerFailure,
  recordExternalServiceLatency,
  recordExternalServiceCall,
  setDependencyHealthStatus,
  syncExternalCircuitBreakerMetrics,
} from "./circuit-breaker-metrics";

// Health endpoints
export {
  healthzEndpoint,
  readyzEndpoint,
  metricsEndpoint,
  dbIndexesHealthEndpoint,
} from "./health-endpoints";

// Initialization
export { initializeMetrics } from "./initialization";

// Service-level metrics (circuit breaker, DLQ, bridge)
export { initializeServiceMetrics, getServiceMetricsStatus } from "./service-metrics";

// Pre-existing modules (re-export for completeness)
export * from "./inventory-metrics";
export * from "./optimizer-metrics";
export * from "./scheduler-metrics";
export * from "./telemetry-metrics";
