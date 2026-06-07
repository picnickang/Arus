const isLocalMode = process.env.LOCAL_MODE === "true" || process.env.EMBEDDED_MODE === "true";
if (process.env.NODE_ENV === "development") {
  console.info(`[Schema Runtime] Mode: ${isLocalMode ? "SQLite (Vessel)" : "PostgreSQL (Cloud)"}`);
}
const DEPLOYMENT_MODE = isLocalMode ? "VESSEL" : "CLOUD";
const IS_SQLITE = isLocalMode;
const IS_POSTGRES = !isLocalMode;
import * as pgSchema from "./schema";
import * as sqliteVessel from "./schema-sqlite-vessel";
import * as sqliteSync from "./schema-sqlite-sync";
const organizations = isLocalMode ? sqliteSync.organizationsSqlite : pgSchema.organizations;
const users = isLocalMode ? sqliteSync.usersSqlite : pgSchema.users;
const syncJournal = isLocalMode ? sqliteSync.syncJournalSqlite : pgSchema.syncJournal || sqliteSync.syncJournalSqlite;
const syncOutbox = isLocalMode ? sqliteSync.syncOutboxSqlite : pgSchema.syncOutbox || sqliteSync.syncOutboxSqlite;
const vessels = isLocalMode ? sqliteVessel.vesselsSqlite : pgSchema.vessels;
const equipment = isLocalMode ? sqliteVessel.equipmentSqlite : pgSchema.equipment;
const devices = isLocalMode ? sqliteVessel.devicesSqlite : pgSchema.devices;
const equipmentTelemetry = isLocalMode ? sqliteVessel.equipmentTelemetrySqlite : pgSchema.equipmentTelemetry;
const equipmentLifecycle = isLocalMode ? sqliteVessel.equipmentLifecycleSqlite : pgSchema.equipmentLifecycle;
const performanceMetrics = isLocalMode ? sqliteVessel.performanceMetricsSqlite : pgSchema.performanceMetrics;
const rawTelemetry = isLocalMode ? sqliteVessel.rawTelemetrySqlite : pgSchema.rawTelemetry;
const deviceRegistry = isLocalMode ? sqliteVessel.deviceRegistrySqlite : pgSchema.deviceRegistry;
const workOrders = isLocalMode ? sqliteVessel.workOrdersSqlite : pgSchema.workOrders;
const workOrderCompletions = isLocalMode ? sqliteVessel.workOrderCompletionsSqlite : pgSchema.workOrderCompletions;
const workOrderParts = isLocalMode ? sqliteVessel.workOrderPartsSqlite : pgSchema.workOrderParts;
const workOrderChecklists = isLocalMode ? sqliteVessel.workOrderChecklistsSqlite : pgSchema.workOrderChecklists;
const workOrderWorklogs = isLocalMode ? sqliteVessel.workOrderWorklogsSqlite : pgSchema.workOrderWorklogs;
const maintenanceSchedules = isLocalMode ? sqliteVessel.maintenanceSchedulesSqlite : pgSchema.maintenanceSchedules;
const maintenanceRecords = isLocalMode ? sqliteVessel.maintenanceRecordsSqlite : pgSchema.maintenanceRecords;
const maintenanceCosts = isLocalMode ? sqliteVessel.maintenanceCostsSqlite : pgSchema.maintenanceCosts;
const maintenanceTemplates = isLocalMode ? sqliteVessel.maintenanceTemplatesSqlite : pgSchema.maintenanceTemplates;
const maintenanceChecklistItems = isLocalMode ? sqliteVessel.maintenanceChecklistItemsSqlite : pgSchema.maintenanceChecklistItems;
const maintenanceChecklistCompletions = isLocalMode ? sqliteVessel.maintenanceChecklistCompletionsSqlite : pgSchema.maintenanceChecklistCompletions;
const maintenanceWindows = isLocalMode ? sqliteVessel.maintenanceWindowsSqlite : pgSchema.maintenanceWindows;
const downtimeEvents = isLocalMode ? sqliteVessel.downtimeEventsSqlite : pgSchema.downtimeEvents;
const parts = isLocalMode ? sqliteVessel.partsSqlite : pgSchema.parts;
const partsInventory = isLocalMode ? sqliteVessel.partsInventorySqlite : pgSchema.partsInventory;
const inventoryParts = isLocalMode ? sqliteVessel.inventoryPartsSqlite : pgSchema.inventoryParts;
const stock = isLocalMode ? sqliteVessel.stockSqlite : pgSchema.stock;
const inventoryMovements = isLocalMode ? sqliteVessel.inventoryMovementsSqlite : pgSchema.inventoryMovements;
const suppliers = isLocalMode ? sqliteVessel.suppliersSqlite : pgSchema.suppliers;
const purchaseOrders = isLocalMode ? sqliteVessel.purchaseOrdersSqlite : pgSchema.purchaseOrders;
const purchaseOrderItems = isLocalMode ? sqliteVessel.purchaseOrderItemsSqlite : pgSchema.purchaseOrderItems;
const partSubstitutions = isLocalMode ? sqliteVessel.partSubstitutionsSqlite : pgSchema.partSubstitutions;
const partFailureHistory = isLocalMode ? sqliteVessel.partFailureHistorySqlite : pgSchema.partFailureHistory;
const reservations = isLocalMode ? sqliteVessel.reservationsSqlite : pgSchema.reservations;
const crew = isLocalMode ? sqliteVessel.crewSqlite : pgSchema.crew;
const skills = isLocalMode ? sqliteVessel.skillsSqlite : pgSchema.skills;
const crewSkill = isLocalMode ? sqliteVessel.crewSkillSqlite : pgSchema.crewSkill;
const crewAssignment = isLocalMode ? sqliteVessel.crewAssignmentSqlite : pgSchema.crewAssignment;
const crewCertification = isLocalMode ? sqliteVessel.crewCertificationSqlite : pgSchema.crewCertification;
const crewLeave = isLocalMode ? sqliteVessel.crewLeaveSqlite : pgSchema.crewLeave;
const shiftTemplate = isLocalMode ? sqliteVessel.shiftTemplateSqlite : pgSchema.shiftTemplate;
const crewRestSheet = isLocalMode ? sqliteVessel.crewRestSheetSqlite : pgSchema.crewRestSheet;
const crewRestDay = isLocalMode ? sqliteVessel.crewRestDaySqlite : pgSchema.crewRestDay;
const sensorConfigurations = isLocalMode ? sqliteVessel.sensorConfigurationsSqlite : pgSchema.sensorConfigurations;
const sensorStates = isLocalMode ? sqliteVessel.sensorStatesSqlite : pgSchema.sensorStates;
const sensorTemplates = isLocalMode ? sqliteVessel.sensorTemplatesSqlite : pgSchema.sensorTemplates;
const sensorBundles = isLocalMode ? sqliteVessel.sensorBundlesSqlite : pgSchema.sensorBundles;
const sensorTypes = isLocalMode ? sqliteVessel.sensorTypesSqlite : pgSchema.sensorTypes;
const sensorThresholds = isLocalMode ? sqliteVessel.sensorThresholdsSqlite : pgSchema.sensorThresholds;
const sensorMapping = isLocalMode ? sqliteVessel.sensorMappingSqlite : pgSchema.sensorMapping;
const discoveredSignals = isLocalMode ? sqliteVessel.discoveredSignalsSqlite : pgSchema.discoveredSignals;
const alertConfigurations = isLocalMode ? sqliteVessel.alertConfigurationsSqlite : pgSchema.alertConfigurations;
const alertNotifications = isLocalMode ? sqliteVessel.alertNotificationsSqlite : pgSchema.alertNotifications;
const alertSuppressions = isLocalMode ? sqliteVessel.alertSuppressionsSqlite : pgSchema.alertSuppressions;
const alertComments = isLocalMode ? sqliteVessel.alertCommentsSqlite : pgSchema.alertComments;
const operatingConditionAlerts = isLocalMode ? sqliteVessel.operatingConditionAlertsSqlite : pgSchema.operatingConditionAlerts;
const pdmAlerts = isLocalMode ? sqliteVessel.pdmAlertsSqlite : pgSchema.pdmAlerts;
const pdmScoreLogs = isLocalMode ? sqliteVessel.pdmScoreLogsSqlite : pgSchema.pdmScoreLogs;
const pdmBaseline = isLocalMode ? sqliteVessel.pdmBaselineSqlite : pgSchema.pdmBaseline;
const mlModels = isLocalMode ? sqliteVessel.mlModelsSqlite : pgSchema.mlModels;
const mlModelAccuracyHistory = isLocalMode ? sqliteVessel.mlModelAccuracyHistorySqlite : pgSchema.mlModelAccuracyHistory || sqliteVessel.mlModelAccuracyHistorySqlite;
const failurePredictions = isLocalMode ? sqliteVessel.failurePredictionsSqlite : pgSchema.failurePredictions;
const anomalyDetections = isLocalMode ? sqliteVessel.anomalyDetectionsSqlite : pgSchema.anomalyDetections;
const componentDegradation = isLocalMode ? sqliteVessel.componentDegradationSqlite : pgSchema.componentDegradation;
const failureHistory = isLocalMode ? sqliteVessel.failureHistorySqlite : pgSchema.failureHistory;
const predictionFeedback = isLocalMode ? sqliteVessel.predictionFeedbackSqlite : pgSchema.predictionFeedback;
const modelPerformanceValidations = isLocalMode ? sqliteVessel.modelPerformanceValidationsSqlite : pgSchema.modelPerformanceValidations;
const retrainingTriggers = isLocalMode ? sqliteVessel.retrainingTriggersSqlite : pgSchema.retrainingTriggers;
const thresholdOptimizations = isLocalMode ? sqliteVessel.thresholdOptimizationsSqlite : pgSchema.thresholdOptimizations;
const modelRegistry = isLocalMode ? sqliteVessel.modelRegistrySqlite : pgSchema.modelRegistry;
const rulModels = isLocalMode ? sqliteVessel.rulModelsSqlite : pgSchema.rulModels;
const rulFitHistory = isLocalMode ? sqliteVessel.rulFitHistorySqlite : pgSchema.rulFitHistory;
const weibullEstimates = isLocalMode ? sqliteVessel.weibullEstimatesSqlite : pgSchema.weibullEstimates;
const insightSnapshots = isLocalMode ? sqliteVessel.insightSnapshotsSqlite : pgSchema.insightSnapshots;
const insightReports = isLocalMode ? sqliteVessel.insightReportsSqlite : pgSchema.insightReports;
const metricsHistory = isLocalMode ? sqliteVessel.metricsHistorySqlite : pgSchema.metricsHistory;
const dailyMetricRollups = isLocalMode ? sqliteVessel.dailyMetricRollupsSqlite : pgSchema.dailyMetricRollups;
const dataQualityMetrics = isLocalMode ? sqliteVessel.dataQualityMetricsSqlite : pgSchema.dataQualityMetrics;
const telemetryAggregates = isLocalMode ? sqliteVessel.telemetryAggregatesSqlite : pgSchema.telemetryAggregates;
const telemetryRollups = isLocalMode ? sqliteVessel.telemetryRollupsSqlite : pgSchema.telemetryRollups;
const industryBenchmarks = isLocalMode ? sqliteVessel.industryBenchmarksSqlite : pgSchema.industryBenchmarks;
const dtcDefinitions = isLocalMode ? sqliteVessel.dtcDefinitionsSqlite : pgSchema.dtcDefinitions;
const dtcFaults = isLocalMode ? sqliteVessel.dtcFaultsSqlite : pgSchema.dtcFaults;
const systemSettings = isLocalMode ? sqliteVessel.systemSettingsSqlite : pgSchema.systemSettings;
const systemPerformanceMetrics = isLocalMode ? sqliteVessel.systemPerformanceMetricsSqlite : pgSchema.systemPerformanceMetrics;
const systemHealthChecks = isLocalMode ? sqliteVessel.systemHealthChecksSqlite : pgSchema.systemHealthChecks;
const transportSettings = isLocalMode ? sqliteVessel.transportSettingsSqlite : pgSchema.transportSettings;
const transportFailovers = isLocalMode ? sqliteVessel.transportFailoversSqlite : pgSchema.transportFailovers;
const integrationConfigs = isLocalMode ? sqliteVessel.integrationConfigsSqlite : pgSchema.integrationConfigs;
const storageConfig = isLocalMode ? sqliteVessel.storageConfigSqlite : pgSchema.storageConfig;
const edgeHeartbeats = isLocalMode ? sqliteVessel.edgeHeartbeatsSqlite : pgSchema.edgeHeartbeats;
const edgeDiagnosticLogs = isLocalMode ? sqliteVessel.edgeDiagnosticLogsSqlite : pgSchema.edgeDiagnosticLogs;
const mqttDevices = isLocalMode ? sqliteVessel.mqttDevicesSqlite : pgSchema.mqttDevices;
const serialPortStates = isLocalMode ? sqliteVessel.serialPortStatesSqlite : pgSchema.serialPortStates;
const j1939Configurations = isLocalMode ? sqliteVessel.j1939ConfigurationsSqlite : pgSchema.j1939Configurations;
const calibrationCache = isLocalMode ? sqliteVessel.calibrationCacheSqlite : pgSchema.calibrationCache;
const conditionMonitoring = isLocalMode ? sqliteVessel.conditionMonitoringSqlite : pgSchema.conditionMonitoring;
const oilAnalysis = isLocalMode ? sqliteVessel.oilAnalysisSqlite : pgSchema.oilAnalysis;
const wearParticleAnalysis = isLocalMode ? sqliteVessel.wearParticleAnalysisSqlite : pgSchema.wearParticleAnalysis;
const oilChangeRecords = isLocalMode ? sqliteVessel.oilChangeRecordsSqlite : pgSchema.oilChangeRecords;
const vibrationFeatures = isLocalMode ? sqliteVessel.vibrationFeaturesSqlite : pgSchema.vibrationFeatures;
const vibrationAnalysis = isLocalMode ? sqliteVessel.vibrationAnalysisSqlite : pgSchema.vibrationAnalysis;
const operatingParameters = isLocalMode ? sqliteVessel.operatingParametersSqlite : pgSchema.operatingParameters;
const scheduleOptimizations = isLocalMode ? sqliteVessel.scheduleOptimizationsSqlite : pgSchema.scheduleOptimizations;
const optimizerConfigurations = isLocalMode ? sqliteVessel.optimizerConfigurationsSqlite : pgSchema.optimizerConfigurations;
const resourceConstraints = isLocalMode ? sqliteVessel.resourceConstraintsSqlite : pgSchema.resourceConstraints;
const optimizationResults = isLocalMode ? sqliteVessel.optimizationResultsSqlite : pgSchema.optimizationResults;
const complianceBundles = isLocalMode ? sqliteVessel.complianceBundlesSqlite : pgSchema.complianceBundles;
const complianceDocs = isLocalMode ? sqliteVessel.complianceDocsSqlite : pgSchema.complianceDocs;
const complianceAuditLog = isLocalMode ? sqliteVessel.complianceAuditLogSqlite : pgSchema.complianceAuditLog;
const costSavings = isLocalMode ? sqliteVessel.costSavingsSqlite : pgSchema.costSavings;
const costModel = isLocalMode ? sqliteVessel.costModelSqlite : pgSchema.costModel;
const laborRates = isLocalMode ? sqliteVessel.laborRatesSqlite : pgSchema.laborRates;
const expenses = isLocalMode ? sqliteVessel.expensesSqlite : pgSchema.expenses;
const portCall = isLocalMode ? sqliteVessel.portCallSqlite : pgSchema.portCall;
const drydockWindow = isLocalMode ? sqliteVessel.drydockWindowSqlite : pgSchema.drydockWindow;
const digitalTwins = isLocalMode ? sqliteVessel.digitalTwinsSqlite : pgSchema.digitalTwins;
const twinSimulations = isLocalMode ? sqliteVessel.twinSimulationsSqlite : pgSchema.twinSimulations;
const visualizationAssets = isLocalMode ? sqliteVessel.visualizationAssetsSqlite : pgSchema.visualizationAssets;
const adminAuditEvents = isLocalMode ? sqliteVessel.adminAuditEventsSqlite : pgSchema.adminAuditEvents;
const adminSystemSettings = isLocalMode ? sqliteVessel.adminSystemSettingsSqlite : pgSchema.adminSystemSettings;
const errorLogs = isLocalMode ? sqliteVessel.errorLogsSqlite : pgSchema.errorLogs;
const idempotencyLog = isLocalMode ? sqliteVessel.idempotencyLogSqlite : pgSchema.idempotencyLog;
const requestIdempotency = isLocalMode ? sqliteVessel.requestIdempotencySqlite : pgSchema.requestIdempotency;
const arMaintenanceProcedures = isLocalMode ? sqliteVessel.arMaintenanceProceduresSqlite : pgSchema.arMaintenanceProcedures;
const beastModeConfig = isLocalMode ? sqliteVessel.beastModeConfigSqlite : pgSchema.beastModeConfig;
const telemetryRetentionPolicies = isLocalMode ? sqliteVessel.telemetryRetentionPoliciesSqlite : pgSchema.telemetryRetentionPolicies;
const opsDbStaged = isLocalMode ? sqliteVessel.opsDbStagedSqlite : pgSchema.opsDbStaged;
const replayIncoming = isLocalMode ? sqliteVessel.replayIncomingSqlite : pgSchema.replayIncoming;
const sheetLock = isLocalMode ? sqliteVessel.sheetLockSqlite : pgSchema.sheetLock;
const sheetVersion = isLocalMode ? sqliteVessel.sheetVersionSqlite : pgSchema.sheetVersion;
const dbSchemaVersion = isLocalMode ? sqliteVessel.dbSchemaVersionSqlite : pgSchema.dbSchemaVersion;
const llmBudgetConfigs = isLocalMode ? sqliteVessel.llmBudgetConfigsSqlite : pgSchema.llmBudgetConfigs;
const llmCostTracking = isLocalMode ? sqliteVessel.llmCostTrackingSqlite : pgSchema.llmCostTracking;
const ragSearchQueries = isLocalMode ? sqliteVessel.ragSearchQueriesSqlite : pgSchema.ragSearchQueries;
const contentSources = isLocalMode ? sqliteVessel.contentSourcesSqlite : pgSchema.contentSources;
const knowledgeBaseItems = isLocalMode ? sqliteVessel.knowledgeBaseItemsSqlite : pgSchema.kbDocs;
const syncConflicts = isLocalMode ? sqliteVessel.syncConflictsSqlite : pgSchema.syncConflicts || sqliteVessel.syncConflictsSqlite;
const softwarePatches = IS_POSTGRES ? pgSchema.softwarePatches : void 0;
const configAuditLog = IS_POSTGRES ? pgSchema.configAuditLog : void 0;
const updateSettings = IS_POSTGRES ? pgSchema.updateSettings : sqliteSync.updateSettingsSqlite;
const patchDownloads = IS_POSTGRES ? pgSchema.patchDownloads : void 0;
const adminSessions = IS_POSTGRES ? pgSchema.adminSessions : void 0;
const modelDeployments = IS_POSTGRES ? pgSchema.modelDeployments : void 0;
const entityOffsets = IS_POSTGRES ? pgSchema.entityOffsets : void 0;
const contextEvents = IS_POSTGRES ? pgSchema.contextEvents : void 0;
const auditRuns = IS_POSTGRES ? pgSchema.auditRuns : void 0;
const auditWebhookSubscriptions = IS_POSTGRES ? pgSchema.auditWebhookSubscriptions : void 0;
const kbDocs = IS_POSTGRES ? pgSchema.kbDocs : void 0;
const kbChunks = IS_POSTGRES ? pgSchema.kbChunks : void 0;
const kbEmbeddingCache = IS_POSTGRES ? pgSchema.kbEmbeddingCache : void 0;
const weatherCache = IS_POSTGRES ? pgSchema.weatherCache : void 0;
const schedulerRuns = IS_POSTGRES ? pgSchema.schedulerRuns : void 0;
const scheduleAssignments = IS_POSTGRES ? pgSchema.scheduleAssignments : void 0;
const scheduleUnfilled = IS_POSTGRES ? pgSchema.scheduleUnfilled : void 0;
const mlModelsLegacy = IS_POSTGRES ? pgSchema.mlModelsLegacy : void 0;
const calibrationCurves = IS_POSTGRES ? pgSchema.calibrationCurves : void 0;
const realTimePredictions = IS_POSTGRES ? pgSchema.realTimePredictions : void 0;
const featureImportances = IS_POSTGRES ? pgSchema.featureImportances : void 0;
const sensorFusionSnapshots = IS_POSTGRES ? pgSchema.sensorFusionSnapshots : void 0;
const acousticEvents = IS_POSTGRES ? pgSchema.acousticEvents : void 0;
import {
  insertOrganizationSchema,
  insertUserSchema,
  insertEquipmentSchema,
  insertDeviceSchema,
  insertHeartbeatSchema,
  insertPdmScoreSchema,
  insertWorkOrderSchema,
  insertWorkOrderCompletionSchema,
  insertTelemetrySchema,
  insertAlertConfigSchema,
  insertAlertNotificationSchema,
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
  insertTelemetryRollupSchema,
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
  insertInventoryPartSchema,
  insertBeastModeConfigSchema,
  insertPdmBaselineSchema,
  insertPdmAlertSchema,
  insertOilAnalysisSchema,
  insertWearParticleAnalysisSchema,
  insertConditionMonitoringSchema,
  insertOilChangeRecordSchema,
  insertMqttDeviceSchema,
  insertTelemetryAggregateSchema,
  insertDataQualityMetricSchema,
  insertMlModelLegacySchema,
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
  selectSensorTemplateSchema,
  selectSensorBundleSchema,
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
  vesselQuerySchema
} from "./schema";
export {
  DEPLOYMENT_MODE,
  IS_POSTGRES,
  IS_SQLITE,
  acousticEvents,
  adminAuditEvents,
  adminPasswordChangeSchema,
  adminPasswordVerifySchema,
  adminSessionResponseSchema,
  adminSessions,
  adminSystemSettings,
  alertComments,
  alertConfigurations,
  alertNotifications,
  alertSuppressions,
  anomalyDetections,
  arMaintenanceProcedures,
  auditRuns,
  auditWebhookSubscriptions,
  beastModeConfig,
  bulkSensorConfigItemSchema,
  bulkSensorConfigSchema,
  calibrationCache,
  calibrationCurves,
  complianceAuditLog,
  complianceBundles,
  complianceDocs,
  componentDegradation,
  conditionMonitoring,
  configAuditLog,
  contentSources,
  contextEvents,
  costModel,
  costSavings,
  costSavingsCalculateOptionsSchema,
  costSavingsListQuerySchema,
  costSavingsSummaryQuerySchema,
  costSavingsTrendQuerySchema,
  crew,
  crewAssignment,
  crewCertification,
  crewIdSchema,
  crewLeave,
  crewQuerySchema,
  crewRestDay,
  crewRestSheet,
  crewSkill,
  dailyMetricRollups,
  dataQualityMetrics,
  dbSchemaVersion,
  deviceRegistry,
  devices,
  digitalTwins,
  discoveredSignals,
  downtimeCostValidationSchema,
  downtimeEvents,
  drydockWindow,
  dtcDefinitions,
  dtcFaults,
  edgeDiagnosticLogs,
  edgeHeartbeats,
  entityOffsets,
  equipment,
  equipmentAnalyticsQuerySchema,
  equipmentIdQuerySchema,
  equipmentLifecycle,
  equipmentTelemetry,
  errorLogs,
  expenses,
  failureHistory,
  failurePredictions,
  featureImportances,
  fleetManagementQuerySchema,
  horDaySchema,
  horImportSchema,
  horQuerySchema,
  horSheetMetaSchema,
  idempotencyKeySchema,
  idempotencyLog,
  industryBenchmarks,
  ingestPayloadSchema,
  ingestSignalSchema,
  insertAcousticEventSchema,
  insertAdminAuditEventSchema,
  insertAdminSessionSchema,
  insertAdminSystemSettingSchema,
  insertAlertCommentSchema,
  insertAlertConfigSchema,
  insertAlertNotificationSchema,
  insertAlertSuppressionSchema,
  insertAnomalyDetectionSchema,
  insertArMaintenanceProcedureSchema,
  insertAuditRunSchema,
  insertAuditWebhookSubscriptionSchema,
  insertBeastModeConfigSchema,
  insertCalibrationCacheSchema,
  insertCalibrationCurveSchema,
  insertComplianceAuditLogSchema,
  insertComplianceBundleSchema,
  insertComplianceDocSchema,
  insertComponentDegradationSchema,
  insertConditionMonitoringSchema,
  insertConfigAuditLogSchema,
  insertContentSourceSchema,
  insertContextEventSchema,
  insertCostModelSchema,
  insertCostSavingsSchema,
  insertCrewAssignmentSchema,
  insertCrewCertificationSchema,
  insertCrewLeaveSchema,
  insertCrewRestDaySchema,
  insertCrewRestSheetSchema,
  insertCrewSchema,
  insertCrewSkillSchema,
  insertDailyMetricRollupSchema,
  insertDataQualityMetricSchema,
  insertDbSchemaVersionSchema,
  insertDeviceRegistrySchema,
  insertDeviceSchema,
  insertDigitalTwinSchema,
  insertDiscoveredSignalSchema,
  insertDowntimeEventSchema,
  insertDrydockWindowSchema,
  insertDtcDefinitionSchema,
  insertDtcFaultSchema,
  insertEdgeDiagnosticLogSchema,
  insertEquipmentLifecycleSchema,
  insertEquipmentSchema,
  insertErrorLogSchema,
  insertExpenseSchema,
  insertFailureHistorySchema,
  insertFailurePredictionSchema,
  insertFeatureImportanceSchema,
  insertHeartbeatSchema,
  insertIdempotencyLogSchema,
  insertIndustryBenchmarkSchema,
  insertInsightReportSchema,
  insertInsightSnapshotSchema,
  insertIntegrationConfigSchema,
  insertInventoryMovementSchema,
  insertInventoryPartSchema,
  insertJ1939ConfigurationSchema,
  insertKbChunkSchema,
  insertKbDocSchema,
  insertKbEmbeddingCacheSchema,
  insertKnowledgeBaseItemSchema,
  insertLaborRateSchema,
  insertLlmBudgetConfigSchema,
  insertLlmCostTrackingSchema,
  insertMaintenanceChecklistCompletionSchema,
  insertMaintenanceChecklistItemSchema,
  insertMaintenanceCostSchema,
  insertMaintenanceRecordSchema,
  insertMaintenanceScheduleSchema,
  insertMaintenanceTemplateSchema,
  insertMaintenanceWindowSchema,
  insertMlModelAccuracyHistorySchema,
  insertMlModelLegacySchema,
  insertMlModelSchema,
  insertModelDeploymentSchema,
  insertModelPerformanceValidationSchema,
  insertModelRegistrySchema,
  insertMqttDeviceSchema,
  insertOilAnalysisSchema,
  insertOilChangeRecordSchema,
  insertOperatingConditionAlertSchema,
  insertOperatingParameterSchema,
  insertOpsDbStagedSchema,
  insertOptimizationResultSchema,
  insertOptimizerConfigurationSchema,
  insertOrganizationSchema,
  insertPartFailureHistorySchema,
  insertPartSchema,
  insertPartSubstitutionSchema,
  insertPartsInventorySchema,
  insertPdmAlertSchema,
  insertPdmBaselineSchema,
  insertPdmScoreSchema,
  insertPerformanceMetricSchema,
  insertPortCallSchema,
  insertPredictionFeedbackSchema,
  insertPurchaseOrderItemSchema,
  insertPurchaseOrderSchema,
  insertRagSearchQuerySchema,
  insertRawTelemetrySchema,
  insertRealTimePredictionSchema,
  insertReplayIncomingSchema,
  insertRequestIdempotencySchema,
  insertReservationSchema,
  insertResourceConstraintSchema,
  insertRetrainingTriggerSchema,
  insertRulFitHistorySchema,
  insertRulModelSchema,
  insertScheduleAssignmentSchema,
  insertScheduleOptimizationSchema,
  insertScheduleUnfilledSchema,
  insertSchedulerRunSchema,
  insertSensorBundleSchema,
  insertSensorConfigSchema,
  insertSensorFusionSnapshotSchema,
  insertSensorMappingSchema,
  insertSensorStateSchema,
  insertSensorTemplateSchema,
  insertSensorThresholdSchema,
  insertSensorTypeSchema,
  insertSerialPortStateSchema,
  insertSettingsSchema,
  insertSheetLockSchema,
  insertSheetVersionSchema,
  insertShiftTemplateSchema,
  insertSkillSchema,
  insertSoftwarePatchSchema,
  insertStockSchema,
  insertStorageConfigSchema,
  insertSupplierSchema,
  insertSyncJournalSchema,
  insertSyncOutboxSchema,
  insertSystemHealthCheckSchema,
  insertSystemPerformanceMetricSchema,
  insertTelemetryAggregateSchema,
  insertTelemetryRetentionPolicySchema,
  insertTelemetryRollupSchema,
  insertTelemetrySchema,
  insertThresholdOptimizationSchema,
  insertTransportFailoverSchema,
  insertTransportSettingsSchema,
  insertTwinSimulationSchema,
  insertUpdateSettingsSchema,
  insertUserSchema,
  insertVesselSchema,
  insertVibrationAnalysisSchema,
  insertVibrationFeatureSchema,
  insertVisualizationAssetSchema,
  insertWearParticleAnalysisSchema,
  insertWeibullEstimateSchema,
  insertWorkOrderChecklistSchema,
  insertWorkOrderCompletionSchema,
  insertWorkOrderPartsSchema,
  insertWorkOrderSchema,
  insertWorkOrderWorklogSchema,
  insightReports,
  insightSnapshots,
  integrationConfigs,
  inventoryMovements,
  inventoryParts,
  j1939Configurations,
  j1939MappingSchema,
  j1939PgnRuleSchema,
  j1939SpnRuleSchema,
  kbChunks,
  kbDocs,
  kbEmbeddingCache,
  knowledgeBaseItems,
  laborRates,
  llmBudgetConfigs,
  llmCostTracking,
  maintenanceChecklistCompletions,
  maintenanceChecklistItems,
  maintenanceCosts,
  maintenanceQuerySchema,
  maintenanceRecords,
  maintenanceSchedules,
  maintenanceTemplates,
  maintenanceWindows,
  metricsHistory,
  mlAcousticDataSchema,
  mlModelAccuracyHistory,
  mlModelStatusUpdateSchema,
  mlModels,
  mlModelsLegacy,
  mlTrainConfigSchema,
  modelDeployments,
  modelPerformanceValidations,
  modelRegistry,
  mqttDevices,
  oilAnalysis,
  oilChangeRecords,
  operatingConditionAlerts,
  operatingParameters,
  opsDbStaged,
  optimizationResults,
  optimizerConfigurations,
  optionalEquipmentIdQuerySchema,
  organizations,
  paginationQuerySchema,
  partFailureHistory,
  partSubstitutions,
  parts,
  partsInventory,
  patchDownloads,
  pdmAlerts,
  pdmAlertsQuerySchema,
  pdmBaseline,
  pdmBaselineUpdateSchema,
  pdmBearingAnalysisSchema,
  pdmOrgIdHeaderSchema,
  pdmPumpAnalysisSchema,
  pdmScoreLogs,
  performanceMetrics,
  performanceQuerySchema,
  portCall,
  predictionFeedback,
  purchaseOrderItems,
  purchaseOrders,
  ragSearchQueries,
  rangeQuerySchema,
  rawTelemetry,
  realTimePredictions,
  replayIncoming,
  requestIdSchema,
  requestIdempotency,
  reservations,
  resourceConstraints,
  retrainingTriggers,
  rulFitHistory,
  rulModels,
  scheduleAssignments,
  scheduleOptimizations,
  scheduleUnfilled,
  schedulerRuns,
  selectSensorBundleSchema,
  selectSensorTemplateSchema,
  sensorBundles,
  sensorConfigurations,
  sensorFusionSnapshots,
  sensorMapping,
  sensorStates,
  sensorTemplates,
  sensorThresholds,
  sensorTypes,
  serialPortStates,
  sheetLock,
  sheetVersion,
  shiftTemplate,
  skills,
  softwarePatches,
  statusQuerySchema,
  stock,
  storageConfig,
  suppliers,
  syncConflicts,
  syncJournal,
  syncOutbox,
  systemHealthChecks,
  systemPerformanceMetrics,
  systemSettings,
  telemetryAggregates,
  telemetryQuerySchema,
  telemetryRetentionPolicies,
  telemetryRollups,
  thresholdOptimizations,
  timeRangeQuerySchema,
  transportFailovers,
  transportSettings,
  twinSimulations,
  updateMlModelSchema,
  updatePartSchema,
  updatePartSubstitutionSchema,
  updateSettings,
  updateStockSchema,
  updateSupplierSchema,
  updateWorkOrderSchema,
  users,
  utcDateSchema,
  utcTimeSchema,
  utcTimestampSchema,
  vesselIdSchema,
  vesselQuerySchema,
  vessels,
  vibrationAnalysis,
  vibrationFeatures,
  visualizationAssets,
  wearParticleAnalysis,
  weatherCache,
  weibullEstimates,
  workOrderChecklists,
  workOrderCompletions,
  workOrderParts,
  workOrderWorklogs,
  workOrders
};
