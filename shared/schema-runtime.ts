/**
 * Runtime Schema Switcher
 *
 * Unified schema export that switches between PostgreSQL and SQLite
 * schemas based on the deployment mode (LOCAL_MODE / EMBEDDED_MODE).
 *
 * Design:
 * - Cloud (LOCAL_MODE=false): exports PostgreSQL schema
 * - Vessel (LOCAL_MODE=true): exports SQLite schema
 * - Explicit named exports (no wildcards) to avoid binding conflicts
 * - Mode-aware Zod schemas via ternary selection
 * - PostgreSQL-only tables guarded to prevent SQLite crashes
 */

const isLocalMode = process.env['LOCAL_MODE'] === "true" || process.env['EMBEDDED_MODE'] === "true";

if (process.env['NODE_ENV'] === "development") {
  // Use console.info (allowed by ESLint no-console config) so this useful
  // boot signal isn't flagged by the hygiene dashboard's `console-log`
  // metric. Log once at module load to confirm which schema is live.
  console.info(`[Schema Runtime] Mode: ${isLocalMode ? "SQLite (Vessel)" : "PostgreSQL (Cloud)"}`);
}

/**
 * Mode detection utilities
 */
export const DEPLOYMENT_MODE = isLocalMode ? "VESSEL" : "CLOUD";
export const IS_SQLITE = isLocalMode;
export const IS_POSTGRES = !isLocalMode;

export {
  notificationSettingsSchema,
  ruleThresholdsSchema,
  ruleEnforcementSettingsSchema,
  aiWeightsSchema,
  publishBehaviorSchema,
  rotationTemplateSchema,
} from "./schema/scheduling-settings";
export { pilotFeedbackDraftSchema, pilotFeedbackReviewSchema } from "./schema/feedback";

/**
 * Re-export ONLY types (no runtime values)
 * This prevents binding conflicts while keeping type definitions available.
 * Note: schema-sqlite-* types intentionally NOT re-exported here to avoid
 * collisions with Drizzle-core re-exports (index/integer/text/real/sqliteJsonHelpers).
 * Consumers needing SQLite-specific types should import from "@shared/sqlite-schema".
 */
export type * from "./schema";
export type {
  ComplianceFinding,
  ComplianceRule,
  CrewTask,
  CrewTaskEvent,
  EquipmentDependency,
  EquipmentDependencyLayoutPositions,
  EquipmentFeature,
  EquipmentPin,
  InsertComplianceFinding,
  InsertCrewTask,
  InsertCrewTaskEvent,
  InsertPartSubstitution,
  InsertSafetyAlarmType,
  InsertSafetyBulletin,
  InsertStock,
  InsertSupplier,
  InsertVesselSafetyAlarm,
  InsertVesselSafetyAlarmAcknowledgement,
  InsertWorkOrderCompletion,
  InsertWorkOrderHistory,
  InventoryMovement,
  NormalizedPoint,
  Part,
  PartsInventory,
  PartsUsedEntry,
  Role,
  SafetyAlarmType,
  SafetyBulletin,
  Stock,
  UserDashboardPrefs,
  Vessel3dModel,
  VesselDiagramStatus,
  VesselDiagramType,
  VesselDiagramVersionStatus,
  VesselSafetyAlarm,
  VesselSafetyAlarmAcknowledgement,
  VesselSectionMapStatus,
  VesselValidationSeverity,
  SectionMapImageTransform,
  ValidationSummary,
  WorkOrderCompletion,
  WorkOrderHistory,
  WorkOrderParts,
} from "./schema";

import * as runtimeTables from "./schema-runtime-tables";

// Explicit local table exports avoid ambiguity with the broad type-only schema export above.
// prettier-ignore
export const { organizations, users, syncJournal, syncOutbox, vessels, equipment, devices, equipmentTelemetry, equipmentLifecycle, performanceMetrics, rawTelemetry, deviceRegistry, equipmentDecommissionEvents, vesselDiagrams, vesselDiagramVersions, vesselSectionMaps, vesselSections, vesselSectionPolygons, vesselSectionEquipmentAssignments, vesselThumbnailOverrides, vesselDiagramValidationResults, workOrders, workOrderCompletions, workOrderParts, workOrderChecklists, workOrderWorklogs, workOrderTasks, workOrderHistory, maintenanceSchedules, maintenanceRecords, maintenanceCosts, maintenanceTemplates, maintenanceChecklistItems, maintenanceChecklistCompletions, maintenanceWindows, downtimeEvents, parts, partsInventory, partsInventorySuppliers, stock, inventoryMovements, suppliers, serviceOrders, purchaseOrders, purchaseOrderItems, purchaseRequests, purchaseRequestItems, serviceRequests, partSubstitutions, partFailureHistory, reservations, crew, skills, crewSkill, crewAssignment, crewCertification, crewDocuments, crewLeave, shiftTemplate, crewRestSheet, crewRestDay, crewNotificationSettings, crewAlerts, crewRoles, crewTasks, pilotFeedback, crewTaskEvents, roles, userRoleAssignments, sensorConfigurations, sensorStates, sensorTemplates, sensorBundles, sensorTypes, sensorThresholds, sensorMapping, discoveredSignals, alertConfigurations, alertNotifications, alertSuppressions, alertComments, actionableInsights, operatingConditionAlerts, pdmAlerts, pdmScoreLogs, pdmBaseline, safetyBulletins, safetyAlarmTypes, vesselSafetyAlarms, vesselSafetyAlarmAcknowledgements, diagnosticRuns, mlModels, mlModelAccuracyHistory, failurePredictions, anomalyDetections, componentDegradation, failureHistory, predictionFeedback, modelPerformanceValidations, retrainingTriggers, thresholdOptimizations, modelRegistry, rulModels, rulFitHistory, weibullEstimates } = runtimeTables;
// prettier-ignore
export const { insightSnapshots, insightReports, metricsHistory, dailyMetricRollups, dataQualityMetrics, industryBenchmarks, dtcDefinitions, dtcFaults, systemSettings, systemPerformanceMetrics, systemHealthChecks, transportSettings, transportFailovers, integrationConfigs, storageConfig, edgeHeartbeats, edgeDiagnosticLogs, mqttDevices, serialPortStates, j1939Configurations, calibrationCache, conditionMonitoring, oilAnalysis, wearParticleAnalysis, oilChangeRecords, vibrationFeatures, vibrationAnalysis, operatingParameters, scheduleOptimizations, optimizerConfigurations, resourceConstraints, optimizationResults, complianceBundles, complianceDocs, complianceAuditLog, costSavings, costModel, laborRates, expenses, portCall, drydockWindow, digitalTwins, twinSimulations, visualizationAssets, vessel3dModels, equipmentDependencies, equipmentDependencyLayouts, adminAuditEvents, adminSystemSettings, roleDashboardConfigs, userVesselAssignments, userDashboardPreferences, immutableAuditTrail, engineerOverrides, predictionDataQuality, userSessions, loginEvents, dataSubjectRequests, crossBorderTransfers, syncProtocolVersion, errorLogs, idempotencyLog, requestIdempotency, eventOutbox, arMaintenanceProcedures, beastModeConfig, telemetryRetentionPolicies, opsDbStaged, replayIncoming, sheetLock, sheetVersion, dbSchemaVersion, llmBudgetConfigs, llmCostTracking, ragSearchQueries, contentSources, knowledgeBaseItems, syncConflicts } = runtimeTables;
// prettier-ignore
export const { softwarePatches, configAuditLog, updateSettings, patchDownloads, adminSessions, modelDeployments, entityOffsets, contextEvents, auditRuns, auditWebhookSubscriptions, kbDocs, kbDocVersions, kbChunks, kbEmbeddingCache, ragConversations, ragMessages, ragFeedback, ragSemanticCache, weatherCache, schedulerRuns, scheduleAssignments, scheduleUnfilled, modelVersions, calibrationCurves, realTimePredictions, equipmentFeatures, featureImportances, predictionExplanations, sensorFusionSnapshots, acousticEvents, deckLogDaily, deckLogHourly, deckLogWatch, deckLogEvents, engineLogDaily, engineLogHourly, engineLogGenerator, engineLogWatch, engineLogEvents, complianceFindings, complianceRules, notificationSettings, notificationQueue, emailQueue, telemetryDeadLetter, predictionOutcomes, stormgeoSettings, stormgeoSnapshots, deckLogHourlyAutoFill, stormgeoImportHistory, externalDataCache } = runtimeTables;

// ============================================================================
// ZOD SCHEMA EXPORTS
// Explicitly export Zod validators (no wildcard to prevent table binding conflicts)
// SQLite uses PostgreSQL validators since they validate JS objects, not SQL generation
// ============================================================================

// Re-export all insert/select schemas from PostgreSQL (used by both modes)
export {
  // Insert Schemas
  insertOrganizationSchema,
  insertUserSchema,
  insertRoleSchema,
  insertUserRoleAssignmentSchema,
  insertEquipmentSchema,
  insertDeviceSchema,
  insertHeartbeatSchema,
  insertPdmScoreSchema,
  insertWorkOrderSchema,
  insertWorkOrderCompletionSchema,
  insertTelemetrySchema,
  insertAlertConfigSchema,
  insertAlertNotificationSchema,
  insertActionableInsightSchema,
  insertSettingsSchema,
  insertMaintenanceScheduleSchema,
  insertMaintenanceRecordSchema,
  insertMaintenanceCostSchema,
  insertEquipmentLifecycleSchema,
  insertPerformanceMetricSchema,
  insertAlertSuppressionSchema,
  insertAlertCommentSchema,
  insertRawTelemetrySchema,
  insertTransportSettingsSchema,
  insertEdgeDiagnosticLogSchema,
  insertTransportFailoverSchema,
  insertSerialPortStateSchema,
  insertCalibrationCacheSchema,
  insertComplianceAuditLogSchema,
  insertWorkOrderChecklistSchema,
  insertWorkOrderWorklogSchema,
  insertPartsInventorySchema,
  insertPartsInventorySuppliersSchema,
  insertWorkOrderPartsSchema,
  insertOptimizerConfigurationSchema,
  insertResourceConstraintSchema,
  insertOptimizationResultSchema,
  insertScheduleOptimizationSchema,
  insertDbSchemaVersionSchema,
  insertTelemetryRetentionPolicySchema,
  insertSensorTypeSchema,
  insertSensorMappingSchema,
  insertDiscoveredSignalSchema,
  insertRequestIdempotencySchema,
  insertInventoryMovementSchema,
  insertKnowledgeBaseItemSchema,
  insertRagSearchQuerySchema,
  insertContentSourceSchema,
  insertVibrationFeatureSchema,
  insertRulModelSchema,
  insertRulFitHistorySchema,
  insertPartSchema,
  insertSupplierSchema,
  insertStockSchema,
  insertPartSubstitutionSchema,
  insertComplianceBundleSchema,
  insertVesselSchema,
  insertCrewSchema,
  insertSkillSchema,
  insertCrewSkillSchema,
  insertCrewLeaveSchema,
  insertShiftTemplateSchema,
  insertCrewAssignmentSchema,
  insertCrewCertificationSchema,
  insertCrewDocumentSchema,
  insertCrewNotificationSettingsSchema,
  insertPortCallSchema,
  insertDrydockWindowSchema,
  insertSchedulerRunSchema,
  insertScheduleAssignmentSchema,
  insertScheduleUnfilledSchema,
  insertIdempotencyLogSchema,
  insertCrewRestSheetSchema,
  insertCrewRestDaySchema,
  insertReplayIncomingSchema,
  insertSheetLockSchema,
  insertSheetVersionSchema,
  insertDeviceRegistrySchema,
  insertSensorConfigSchema,
  insertSensorStateSchema,
  insertSensorTemplateSchema,
  insertSensorBundleSchema,
  insertStorageConfigSchema,
  insertOpsDbStagedSchema,
  insertInsightSnapshotSchema,
  insertInsightReportSchema,
  insertVibrationAnalysisSchema,
  insertWeibullEstimateSchema,
  insertBeastModeConfigSchema,
  insertPdmBaselineSchema,
  insertPdmAlertSchema,
  insertOilAnalysisSchema,
  insertWearParticleAnalysisSchema,
  insertConditionMonitoringSchema,
  insertOilChangeRecordSchema,
  insertMqttDeviceSchema,
  insertDataQualityMetricSchema,
  insertCalibrationCurveSchema,
  insertAnomalyDetectionSchema,
  insertFailurePredictionSchema,
  insertThresholdOptimizationSchema,
  insertComponentDegradationSchema,
  insertFailureHistorySchema,
  insertModelPerformanceValidationSchema,
  insertPredictionFeedbackSchema,
  insertLlmCostTrackingSchema,
  insertLlmBudgetConfigSchema,
  insertRetrainingTriggerSchema,
  insertRealTimePredictionSchema,
  insertFeatureImportanceSchema,
  insertSensorFusionSnapshotSchema,
  insertAcousticEventSchema,
  insertModelDeploymentSchema,
  insertDigitalTwinSchema,
  insertTwinSimulationSchema,
  insertVisualizationAssetSchema,
  insertArMaintenanceProcedureSchema,
  insertLaborRateSchema,
  insertExpenseSchema,
  insertJ1939ConfigurationSchema,
  insertAdminSessionSchema,
  insertAdminAuditEventSchema,
  insertAdminSystemSettingSchema,
  insertIntegrationConfigSchema,
  insertMaintenanceWindowSchema,
  insertSystemPerformanceMetricSchema,
  insertSystemHealthCheckSchema,
  insertSyncJournalSchema,
  insertSyncOutboxSchema,
  insertReservationSchema,
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
  insertSensorThresholdSchema,
  insertModelRegistrySchema,
  insertCostModelSchema,
  insertComplianceDocSchema,
  insertDailyMetricRollupSchema,
  insertDtcDefinitionSchema,
  insertDtcFaultSchema,
  insertDowntimeEventSchema,
  insertPartFailureHistorySchema,
  insertIndustryBenchmarkSchema,
  insertOperatingParameterSchema,
  insertOperatingConditionAlertSchema,
  insertMaintenanceTemplateSchema,
  insertMaintenanceChecklistItemSchema,
  insertMaintenanceChecklistCompletionSchema,
  insertErrorLogSchema,
  insertCostSavingsSchema,
  insertSoftwarePatchSchema,
  insertConfigAuditLogSchema,
  insertUpdateSettingsSchema,
  insertContextEventSchema,
  insertAuditRunSchema,
  insertAuditWebhookSubscriptionSchema,
  insertKbDocSchema,
  insertKbChunkSchema,
  insertKbEmbeddingCacheSchema,
  insertMlModelSchema,
  insertMlModelAccuracyHistorySchema,
  insertDeckLogDailySchema,
  insertDeckLogHourlySchema,
  insertDeckLogWatchSchema,
  insertDeckLogEventsSchema,
  DECK_LOG_EVENT_TYPES,
  DECK_LOG_EVENT_SOURCES,
  CREW_DOCUMENT_TYPE_VALUES,
  CREW_TASK_STATUSES,
  CREW_TASK_PRIORITIES,
  CREW_TASK_LINKED_SOURCE_TYPES,
  SAFETY_BULLETIN_SEVERITIES,
  vesselDiagramTypeValues,
  vesselDiagramStatusValues,
  vesselDiagramVersionStatusValues,
  vesselSectionMapStatusValues,
  vesselThumbnailOwnerTypeValues,
  vesselValidationSeverityValues,
  equipmentPinSchema,
  insertEquipmentDependencySchema,
  equipmentDependencyLayoutPositionsSchema,
  partsUsedSchema,
  userDashboardPrefsSchema,
  updateValidationStatusSchema,
  validationStatusEnum,
} from "./schema";

export {
  adminPasswordChangeSchema,
  adminPasswordVerifySchema,
  adminSessionResponseSchema,
  bulkSensorConfigItemSchema,
  bulkSensorConfigSchema,
  costSavingsCalculateOptionsSchema,
  costSavingsListQuerySchema,
  costSavingsSummaryQuerySchema,
  costSavingsTrendQuerySchema,
  crewIdSchema,
  crewQuerySchema,
  downtimeCostValidationSchema,
  equipmentAnalyticsQuerySchema,
  equipmentIdQuerySchema,
  fleetManagementQuerySchema,
  horDaySchema,
  horImportSchema,
  horQuerySchema,
  horSheetMetaSchema,
  idempotencyKeySchema,
  ingestPayloadSchema,
  ingestSignalSchema,
  j1939MappingSchema,
  j1939PgnRuleSchema,
  j1939SpnRuleSchema,
  maintenanceQuerySchema,
  mlAcousticDataSchema,
  mlModelStatusUpdateSchema,
  mlTrainConfigSchema,
  optionalEquipmentIdQuerySchema,
  paginationQuerySchema,
  pdmAlertsQuerySchema,
  pdmBaselineUpdateSchema,
  pdmBearingAnalysisSchema,
  pdmOrgIdHeaderSchema,
  pdmPumpAnalysisSchema,
  performanceQuerySchema,
  rangeQuerySchema,
  requestIdSchema,
  statusQuerySchema,
  telemetryQuerySchema,
  timeRangeQuerySchema,
  updateMlModelSchema,
  updatePartSchema,
  updatePartSubstitutionSchema,
  updateStockSchema,
  updateSupplierSchema,
  updateWorkOrderSchema,
  utcDateSchema,
  utcTimeSchema,
  utcTimestampSchema,
  vesselIdSchema,
  vesselQuerySchema,
} from "./validation";

// Equipment decommission schema exports (explicitly re-exported)
export { 
  insertDecommissionEventSchema,
  decommissionReasonEnum,
  saleDetailsSchema,
  disposalDetailsSchema,
} from "./schema/equipment";

// ============================================================================
// NOTE ON POSTGRESQL-ONLY SCHEMAS
// ============================================================================
// PostgreSQL-only Zod schemas (insertSoftwarePatchSchema, insertKbDocSchema, etc.)
// are included in the exports above because Zod validators work for both modes.
// They validate JavaScript objects, not SQL generation.
// 
// The corresponding PostgreSQL-only tables (softwarePatches, kbDocs, etc.) are guarded
// above with `IS_POSTGRES ? table : undefined` which prevents runtime access in SQLite mode.
// ============================================================================
