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

const isLocalMode = process.env.LOCAL_MODE === "true" || process.env.EMBEDDED_MODE === "true";

if (process.env.NODE_ENV === "development") {
  console.log(`[Schema Runtime] Mode: ${isLocalMode ? "SQLite (Vessel)" : "PostgreSQL (Cloud)"}`);
}

/**
 * Mode detection utilities
 */
export const DEPLOYMENT_MODE = isLocalMode ? "VESSEL" : "CLOUD";
export const IS_SQLITE = isLocalMode;
export const IS_POSTGRES = !isLocalMode;

/**
 * Import all schemas at top level (ESBuild requirement)
 */
import * as pgSchema from "./schema";
import * as sqliteVessel from "./schema-sqlite-vessel";
import * as sqliteSync from "./schema-sqlite-sync";

/**
 * Re-export ONLY types (no runtime values)
 * This prevents binding conflicts while keeping type definitions available
 */
export type * from "./schema";
export type * from "./schema-sqlite-vessel";
export type * from "./schema-sqlite-sync";

// ============================================================================
// MODE-AWARE TABLE EXPORTS (All 173 tables)
// Each table uses ternary expression to select correct schema at runtime
// ============================================================================

// Sync Tables (from schema-sqlite-sync)
export const organizations = isLocalMode ? sqliteSync.organizationsSqlite : pgSchema.organizations;
export const users = isLocalMode ? sqliteSync.usersSqlite : pgSchema.users;
export const syncJournal = isLocalMode ? sqliteSync.syncJournalSqlite : (pgSchema.syncJournal || sqliteSync.syncJournalSqlite);
export const syncOutbox = isLocalMode ? sqliteSync.syncOutboxSqlite : (pgSchema.syncOutbox || sqliteSync.syncOutboxSqlite);

// Equipment & Devices
export const vessels = isLocalMode ? sqliteVessel.vesselsSqlite : pgSchema.vessels;
export const equipment = isLocalMode ? sqliteVessel.equipmentSqlite : pgSchema.equipment;
export const devices = isLocalMode ? sqliteVessel.devicesSqlite : pgSchema.devices;
export const equipmentTelemetry = isLocalMode ? sqliteVessel.equipmentTelemetrySqlite : pgSchema.equipmentTelemetry;
export const equipmentLifecycle = isLocalMode ? sqliteVessel.equipmentLifecycleSqlite : pgSchema.equipmentLifecycle;
export const performanceMetrics = isLocalMode ? sqliteVessel.performanceMetricsSqlite : pgSchema.performanceMetrics;
export const rawTelemetry = isLocalMode ? sqliteVessel.rawTelemetrySqlite : pgSchema.rawTelemetry;
export const deviceRegistry = isLocalMode ? sqliteVessel.deviceRegistrySqlite : pgSchema.deviceRegistry;
export const equipmentDecommissionEvents = IS_POSTGRES ? pgSchema.equipmentDecommissionEvents : null; // Cloud-only table

// Work Orders & Maintenance
export const workOrders = isLocalMode ? sqliteVessel.workOrdersSqlite : pgSchema.workOrders;
export const workOrderCompletions = isLocalMode ? sqliteVessel.workOrderCompletionsSqlite : pgSchema.workOrderCompletions;
export const workOrderParts = isLocalMode ? sqliteVessel.workOrderPartsSqlite : pgSchema.workOrderParts;
export const workOrderChecklists = isLocalMode ? sqliteVessel.workOrderChecklistsSqlite : pgSchema.workOrderChecklists;
export const workOrderWorklogs = isLocalMode ? sqliteVessel.workOrderWorklogsSqlite : pgSchema.workOrderWorklogs;
export const workOrderTasks = isLocalMode ? sqliteVessel.workOrderTasksSqlite : pgSchema.workOrderTasks;
export const workOrderHistory = isLocalMode ? sqliteVessel.workOrderHistorySqlite : pgSchema.workOrderHistory;
export const maintenanceSchedules = isLocalMode ? sqliteVessel.maintenanceSchedulesSqlite : pgSchema.maintenanceSchedules;
export const maintenanceRecords = isLocalMode ? sqliteVessel.maintenanceRecordsSqlite : pgSchema.maintenanceRecords;
export const maintenanceCosts = isLocalMode ? sqliteVessel.maintenanceCostsSqlite : pgSchema.maintenanceCosts;
export const maintenanceTemplates = isLocalMode ? sqliteVessel.maintenanceTemplatesSqlite : pgSchema.maintenanceTemplates;
export const maintenanceChecklistItems = isLocalMode ? sqliteVessel.maintenanceChecklistItemsSqlite : pgSchema.maintenanceChecklistItems;
export const maintenanceChecklistCompletions = isLocalMode ? sqliteVessel.maintenanceChecklistCompletionsSqlite : pgSchema.maintenanceChecklistCompletions;
export const maintenanceWindows = isLocalMode ? sqliteVessel.maintenanceWindowsSqlite : pgSchema.maintenanceWindows;
export const downtimeEvents = isLocalMode ? sqliteVessel.downtimeEventsSqlite : pgSchema.downtimeEvents;

// Inventory & Parts
export const parts = isLocalMode ? sqliteVessel.partsSqlite : pgSchema.parts;
export const partsInventory = isLocalMode ? sqliteVessel.partsInventorySqlite : pgSchema.partsInventory;
export const partsInventorySuppliers = IS_POSTGRES ? pgSchema.partsInventorySuppliers : undefined as any; // Cloud-only junction table (multi-supplier support)
export const inventoryParts = isLocalMode ? sqliteVessel.inventoryPartsSqlite : pgSchema.inventoryParts;
export const stock = isLocalMode ? sqliteVessel.stockSqlite : pgSchema.stock;
export const inventoryMovements = isLocalMode ? sqliteVessel.inventoryMovementsSqlite : pgSchema.inventoryMovements;
export const suppliers = isLocalMode ? sqliteVessel.suppliersSqlite : pgSchema.suppliers;
export const serviceOrders = IS_POSTGRES ? pgSchema.serviceOrders : null;
export const purchaseOrders = isLocalMode ? sqliteVessel.purchaseOrdersSqlite : pgSchema.purchaseOrders;
export const purchaseOrderItems = isLocalMode ? sqliteVessel.purchaseOrderItemsSqlite : pgSchema.purchaseOrderItems;
export const purchaseRequests = IS_POSTGRES ? pgSchema.purchaseRequests : null;
export const partSubstitutions = isLocalMode ? sqliteVessel.partSubstitutionsSqlite : pgSchema.partSubstitutions;
export const partFailureHistory = isLocalMode ? sqliteVessel.partFailureHistorySqlite : pgSchema.partFailureHistory;
export const reservations = isLocalMode ? sqliteVessel.reservationsSqlite : pgSchema.reservations;

// Crew Management
export const crew = isLocalMode ? sqliteVessel.crewSqlite : pgSchema.crew;
export const skills = isLocalMode ? sqliteVessel.skillsSqlite : pgSchema.skills;
export const crewSkill = isLocalMode ? sqliteVessel.crewSkillSqlite : pgSchema.crewSkill;
export const crewAssignment = isLocalMode ? sqliteVessel.crewAssignmentSqlite : pgSchema.crewAssignment;
export const crewCertification = isLocalMode ? sqliteVessel.crewCertificationSqlite : pgSchema.crewCertification;
export const crewDocuments = isLocalMode ? sqliteVessel.crewDocumentsSqlite : pgSchema.crewDocuments;
export const crewLeave = isLocalMode ? sqliteVessel.crewLeaveSqlite : pgSchema.crewLeave;
export const shiftTemplate = isLocalMode ? sqliteVessel.shiftTemplateSqlite : pgSchema.shiftTemplate;
export const crewRestSheet = isLocalMode ? sqliteVessel.crewRestSheetSqlite : pgSchema.crewRestSheet;
export const crewRestDay = isLocalMode ? sqliteVessel.crewRestDaySqlite : pgSchema.crewRestDay;
export const crewNotificationSettings = pgSchema.crewNotificationSettings;

// Sensors & Monitoring
export const sensorConfigurations = isLocalMode ? sqliteVessel.sensorConfigurationsSqlite : pgSchema.sensorConfigurations;
export const sensorStates = isLocalMode ? sqliteVessel.sensorStatesSqlite : pgSchema.sensorStates;
export const sensorTemplates = isLocalMode ? sqliteVessel.sensorTemplatesSqlite : pgSchema.sensorTemplates;
export const sensorBundles = isLocalMode ? sqliteVessel.sensorBundlesSqlite : pgSchema.sensorBundles;
export const sensorTypes = isLocalMode ? sqliteVessel.sensorTypesSqlite : pgSchema.sensorTypes;
export const sensorThresholds = isLocalMode ? sqliteVessel.sensorThresholdsSqlite : pgSchema.sensorThresholds;
export const sensorMapping = isLocalMode ? sqliteVessel.sensorMappingSqlite : pgSchema.sensorMapping;
export const discoveredSignals = isLocalMode ? sqliteVessel.discoveredSignalsSqlite : pgSchema.discoveredSignals;

// Alerts & Notifications
export const alertConfigurations = isLocalMode ? sqliteVessel.alertConfigurationsSqlite : pgSchema.alertConfigurations;
export const alertNotifications = isLocalMode ? sqliteVessel.alertNotificationsSqlite : pgSchema.alertNotifications;
export const alertSuppressions = isLocalMode ? sqliteVessel.alertSuppressionsSqlite : pgSchema.alertSuppressions;
export const alertComments = isLocalMode ? sqliteVessel.alertCommentsSqlite : pgSchema.alertComments;
export const actionableInsights = isLocalMode ? sqliteVessel.actionableInsightsSqlite : pgSchema.actionableInsights;
export const operatingConditionAlerts = isLocalMode ? sqliteVessel.operatingConditionAlertsSqlite : pgSchema.operatingConditionAlerts;
export const pdmAlerts = isLocalMode ? sqliteVessel.pdmAlertsSqlite : pgSchema.pdmAlerts;
export const pdmScoreLogs = isLocalMode ? sqliteVessel.pdmScoreLogsSqlite : pgSchema.pdmScoreLogs;
export const pdmBaseline = isLocalMode ? sqliteVessel.pdmBaselineSqlite : pgSchema.pdmBaseline;

export const diagnosticRuns = IS_POSTGRES ? pgSchema.diagnosticRuns : null;

// ML & Predictive Maintenance
export const mlModels = isLocalMode ? sqliteVessel.mlModelsSqlite : pgSchema.mlModels;
export const mlModelAccuracyHistory = isLocalMode ? sqliteVessel.mlModelAccuracyHistorySqlite : (pgSchema.mlModelAccuracyHistory || sqliteVessel.mlModelAccuracyHistorySqlite);
export const failurePredictions = isLocalMode ? sqliteVessel.failurePredictionsSqlite : pgSchema.failurePredictions;
export const anomalyDetections = isLocalMode ? sqliteVessel.anomalyDetectionsSqlite : pgSchema.anomalyDetections;
export const componentDegradation = isLocalMode ? sqliteVessel.componentDegradationSqlite : pgSchema.componentDegradation;
export const failureHistory = isLocalMode ? sqliteVessel.failureHistorySqlite : pgSchema.failureHistory;
export const predictionFeedback = isLocalMode ? sqliteVessel.predictionFeedbackSqlite : pgSchema.predictionFeedback;
export const modelPerformanceValidations = isLocalMode ? sqliteVessel.modelPerformanceValidationsSqlite : pgSchema.modelPerformanceValidations;
export const retrainingTriggers = isLocalMode ? sqliteVessel.retrainingTriggersSqlite : pgSchema.retrainingTriggers;
export const thresholdOptimizations = isLocalMode ? sqliteVessel.thresholdOptimizationsSqlite : pgSchema.thresholdOptimizations;
export const modelRegistry = isLocalMode ? sqliteVessel.modelRegistrySqlite : pgSchema.modelRegistry;
export const rulModels = isLocalMode ? sqliteVessel.rulModelsSqlite : pgSchema.rulModels;
export const rulFitHistory = isLocalMode ? sqliteVessel.rulFitHistorySqlite : pgSchema.rulFitHistory;
export const weibullEstimates = isLocalMode ? sqliteVessel.weibullEstimatesSqlite : pgSchema.weibullEstimates;

// Insights & Analytics
export const insightSnapshots = isLocalMode ? sqliteVessel.insightSnapshotsSqlite : pgSchema.insightSnapshots;
export const insightReports = isLocalMode ? sqliteVessel.insightReportsSqlite : pgSchema.insightReports;
export const metricsHistory = isLocalMode ? sqliteVessel.metricsHistorySqlite : pgSchema.metricsHistory;
export const dailyMetricRollups = isLocalMode ? sqliteVessel.dailyMetricRollupsSqlite : pgSchema.dailyMetricRollups;
export const dataQualityMetrics = isLocalMode ? sqliteVessel.dataQualityMetricsSqlite : pgSchema.dataQualityMetrics;
export const telemetryAggregates = isLocalMode ? sqliteVessel.telemetryAggregatesSqlite : pgSchema.telemetryAggregates;
export const telemetryRollups = isLocalMode ? sqliteVessel.telemetryRollupsSqlite : pgSchema.telemetryRollups;
export const industryBenchmarks = isLocalMode ? sqliteVessel.industryBenchmarksSqlite : pgSchema.industryBenchmarks;

// DTC & Diagnostics
export const dtcDefinitions = isLocalMode ? sqliteVessel.dtcDefinitionsSqlite : pgSchema.dtcDefinitions;
export const dtcFaults = isLocalMode ? sqliteVessel.dtcFaultsSqlite : pgSchema.dtcFaults;

// System & Configuration
export const systemSettings = isLocalMode ? sqliteVessel.systemSettingsSqlite : pgSchema.systemSettings;
export const systemPerformanceMetrics = isLocalMode ? sqliteVessel.systemPerformanceMetricsSqlite : pgSchema.systemPerformanceMetrics;
export const systemHealthChecks = isLocalMode ? sqliteVessel.systemHealthChecksSqlite : pgSchema.systemHealthChecks;
export const transportSettings = isLocalMode ? sqliteVessel.transportSettingsSqlite : pgSchema.transportSettings;
export const transportFailovers = isLocalMode ? sqliteVessel.transportFailoversSqlite : pgSchema.transportFailovers;
export const integrationConfigs = isLocalMode ? sqliteVessel.integrationConfigsSqlite : pgSchema.integrationConfigs;
export const storageConfig = isLocalMode ? sqliteVessel.storageConfigSqlite : pgSchema.storageConfig;

// Edge & IoT
export const edgeHeartbeats = isLocalMode ? sqliteVessel.edgeHeartbeatsSqlite : pgSchema.edgeHeartbeats;
export const edgeDiagnosticLogs = isLocalMode ? sqliteVessel.edgeDiagnosticLogsSqlite : pgSchema.edgeDiagnosticLogs;
export const mqttDevices = isLocalMode ? sqliteVessel.mqttDevicesSqlite : pgSchema.mqttDevices;
export const serialPortStates = isLocalMode ? sqliteVessel.serialPortStatesSqlite : pgSchema.serialPortStates;
export const j1939Configurations = isLocalMode ? sqliteVessel.j1939ConfigurationsSqlite : pgSchema.j1939Configurations;
export const calibrationCache = isLocalMode ? sqliteVessel.calibrationCacheSqlite : pgSchema.calibrationCache;

// Condition Monitoring
export const conditionMonitoring = isLocalMode ? sqliteVessel.conditionMonitoringSqlite : pgSchema.conditionMonitoring;
export const oilAnalysis = isLocalMode ? sqliteVessel.oilAnalysisSqlite : pgSchema.oilAnalysis;
export const wearParticleAnalysis = isLocalMode ? sqliteVessel.wearParticleAnalysisSqlite : pgSchema.wearParticleAnalysis;
export const oilChangeRecords = isLocalMode ? sqliteVessel.oilChangeRecordsSqlite : pgSchema.oilChangeRecords;
export const vibrationFeatures = isLocalMode ? sqliteVessel.vibrationFeaturesSqlite : pgSchema.vibrationFeatures;
export const vibrationAnalysis = isLocalMode ? sqliteVessel.vibrationAnalysisSqlite : pgSchema.vibrationAnalysis;
export const operatingParameters = isLocalMode ? sqliteVessel.operatingParametersSqlite : pgSchema.operatingParameters;

// Scheduling & Optimization
export const scheduleOptimizations = isLocalMode ? sqliteVessel.scheduleOptimizationsSqlite : pgSchema.scheduleOptimizations;
export const optimizerConfigurations = isLocalMode ? sqliteVessel.optimizerConfigurationsSqlite : pgSchema.optimizerConfigurations;
export const resourceConstraints = isLocalMode ? sqliteVessel.resourceConstraintsSqlite : pgSchema.resourceConstraints;
export const optimizationResults = isLocalMode ? sqliteVessel.optimizationResultsSqlite : pgSchema.optimizationResults;

// Compliance & Costs
export const complianceBundles = isLocalMode ? sqliteVessel.complianceBundlesSqlite : pgSchema.complianceBundles;
export const complianceDocs = isLocalMode ? sqliteVessel.complianceDocsSqlite : pgSchema.complianceDocs;
export const complianceAuditLog = isLocalMode ? sqliteVessel.complianceAuditLogSqlite : pgSchema.complianceAuditLog;
export const costSavings = isLocalMode ? sqliteVessel.costSavingsSqlite : pgSchema.costSavings;
export const costModel = isLocalMode ? sqliteVessel.costModelSqlite : pgSchema.costModel;
export const laborRates = isLocalMode ? sqliteVessel.laborRatesSqlite : pgSchema.laborRates;
export const expenses = isLocalMode ? sqliteVessel.expensesSqlite : pgSchema.expenses;

// Vessel Operations
export const portCall = isLocalMode ? sqliteVessel.portCallSqlite : pgSchema.portCall;
export const drydockWindow = isLocalMode ? sqliteVessel.drydockWindowSqlite : pgSchema.drydockWindow;

// Digital Twin & Simulation
export const digitalTwins = isLocalMode ? sqliteVessel.digitalTwinsSqlite : pgSchema.digitalTwins;
export const twinSimulations = isLocalMode ? sqliteVessel.twinSimulationsSqlite : pgSchema.twinSimulations;
export const visualizationAssets = isLocalMode ? sqliteVessel.visualizationAssetsSqlite : pgSchema.visualizationAssets;

// Admin & Security
export const adminAuditEvents = isLocalMode ? sqliteVessel.adminAuditEventsSqlite : pgSchema.adminAuditEvents;
export const adminSystemSettings = isLocalMode ? sqliteVessel.adminSystemSettingsSqlite : pgSchema.adminSystemSettings;

// Compliance & Security Infrastructure (Phase 1 Compliance Hardening)
export const immutableAuditTrail = isLocalMode ? sqliteVessel.immutableAuditTrailSqlite : pgSchema.immutableAuditTrail;
export const engineerOverrides = isLocalMode ? sqliteVessel.engineerOverridesSqlite : pgSchema.engineerOverrides;
export const predictionDataQuality = isLocalMode ? sqliteVessel.predictionDataQualitySqlite : pgSchema.predictionDataQuality;
export const userSessions = isLocalMode ? sqliteVessel.userSessionsSqlite : pgSchema.userSessions;
export const loginEvents = isLocalMode ? sqliteVessel.loginEventsSqlite : pgSchema.loginEvents;
export const dataSubjectRequests = isLocalMode ? sqliteVessel.dataSubjectRequestsSqlite : pgSchema.dataSubjectRequests;
export const crossBorderTransfers = isLocalMode ? sqliteVessel.crossBorderTransfersSqlite : pgSchema.crossBorderTransfers;
export const syncProtocolVersion = isLocalMode ? sqliteVessel.syncProtocolVersionSqlite : pgSchema.syncProtocolVersion;

// Error Handling & Logging
export const errorLogs = isLocalMode ? sqliteVessel.errorLogsSqlite : pgSchema.errorLogs;
export const idempotencyLog = isLocalMode ? sqliteVessel.idempotencyLogSqlite : pgSchema.idempotencyLog;
export const requestIdempotency = isLocalMode ? sqliteVessel.requestIdempotencySqlite : pgSchema.requestIdempotency;

// AR & Advanced Features
export const arMaintenanceProcedures = isLocalMode ? sqliteVessel.arMaintenanceProceduresSqlite : pgSchema.arMaintenanceProcedures;
export const beastModeConfig = isLocalMode ? sqliteVessel.beastModeConfigSqlite : pgSchema.beastModeConfig;

// Telemetry & Data Management
export const telemetryRetentionPolicies = isLocalMode ? sqliteVessel.telemetryRetentionPoliciesSqlite : pgSchema.telemetryRetentionPolicies;
export const opsDbStaged = isLocalMode ? sqliteVessel.opsDbStagedSqlite : pgSchema.opsDbStaged;
export const replayIncoming = isLocalMode ? sqliteVessel.replayIncomingSqlite : pgSchema.replayIncoming;
export const sheetLock = isLocalMode ? sqliteVessel.sheetLockSqlite : pgSchema.sheetLock;
export const sheetVersion = isLocalMode ? sqliteVessel.sheetVersionSqlite : pgSchema.sheetVersion;
export const dbSchemaVersion = isLocalMode ? sqliteVessel.dbSchemaVersionSqlite : pgSchema.dbSchemaVersion;

// LLM & AI Features
export const llmBudgetConfigs = isLocalMode ? sqliteVessel.llmBudgetConfigsSqlite : pgSchema.llmBudgetConfigs;
export const llmCostTracking = isLocalMode ? sqliteVessel.llmCostTrackingSqlite : pgSchema.llmCostTracking;
export const ragSearchQueries = isLocalMode ? sqliteVessel.ragSearchQueriesSqlite : pgSchema.ragSearchQueries;
export const contentSources = isLocalMode ? sqliteVessel.contentSourcesSqlite : pgSchema.contentSources;
export const knowledgeBaseItems = isLocalMode ? sqliteVessel.knowledgeBaseItemsSqlite : pgSchema.kbDocs;

// Sync & Conflicts
export const syncConflicts = isLocalMode ? sqliteVessel.syncConflictsSqlite : (pgSchema.syncConflicts || sqliteVessel.syncConflictsSqlite);

// ============================================================================
// POSTGRESQL-ONLY TABLES (guarded exports - undefined in SQLite mode)
// These tables only exist in cloud deployments and will crash if accessed in SQLite mode
// ============================================================================
export const softwarePatches = IS_POSTGRES ? pgSchema.softwarePatches : undefined as any;
export const configAuditLog = IS_POSTGRES ? pgSchema.configAuditLog : undefined as any;
export const updateSettings = IS_POSTGRES ? pgSchema.updateSettings : sqliteSync.updateSettingsSqlite;
export const patchDownloads = IS_POSTGRES ? pgSchema.patchDownloads : undefined as any;
export const adminSessions = IS_POSTGRES ? pgSchema.adminSessions : undefined as any;
export const modelDeployments = IS_POSTGRES ? pgSchema.modelDeployments : undefined as any;
export const entityOffsets = IS_POSTGRES ? pgSchema.entityOffsets : undefined as any;
export const contextEvents = IS_POSTGRES ? pgSchema.contextEvents : undefined as any;
export const auditRuns = IS_POSTGRES ? pgSchema.auditRuns : undefined as any;
export const auditWebhookSubscriptions = IS_POSTGRES ? pgSchema.auditWebhookSubscriptions : undefined as any;
export const kbDocs = IS_POSTGRES ? pgSchema.kbDocs : undefined as any; // Note: knowledgeBaseItems is the SQLite equivalent
export const kbDocVersions = IS_POSTGRES ? pgSchema.kbDocVersions : undefined as any;
export const kbChunks = IS_POSTGRES ? pgSchema.kbChunks : undefined as any;
export const kbEmbeddingCache = IS_POSTGRES ? pgSchema.kbEmbeddingCache : undefined as any;

// RAG Conversation System (PostgreSQL-only)
export const ragConversations = IS_POSTGRES ? pgSchema.ragConversations : undefined as any;
export const ragMessages = IS_POSTGRES ? pgSchema.ragMessages : undefined as any;
export const ragFeedback = IS_POSTGRES ? pgSchema.ragFeedback : undefined as any;
export const ragSemanticCache = IS_POSTGRES ? pgSchema.ragSemanticCache : undefined as any;
export const weatherCache = IS_POSTGRES ? pgSchema.weatherCache : undefined as any;
export const schedulerRuns = IS_POSTGRES ? pgSchema.schedulerRuns : sqliteVessel.schedulerRunsSqlite;
export const scheduleAssignments = IS_POSTGRES ? pgSchema.scheduleAssignments : sqliteVessel.scheduleAssignmentsSqlite;
export const scheduleUnfilled = IS_POSTGRES ? pgSchema.scheduleUnfilled : sqliteVessel.scheduleUnfilledSqlite;
export const mlModelsLegacy = IS_POSTGRES ? pgSchema.mlModelsLegacy : undefined as any;
export const calibrationCurves = IS_POSTGRES ? pgSchema.calibrationCurves : undefined as any;
export const realTimePredictions = IS_POSTGRES ? pgSchema.realTimePredictions : undefined as any;
export const featureImportances = IS_POSTGRES ? pgSchema.featureImportances : undefined as any;
export const sensorFusionSnapshots = IS_POSTGRES ? pgSchema.sensorFusionSnapshots : undefined as any;
export const acousticEvents = IS_POSTGRES ? pgSchema.acousticEvents : undefined as any;

// Digital Deck Logbook
export const deckLogDaily = IS_POSTGRES ? pgSchema.deckLogDaily : undefined as any;
export const deckLogHourly = IS_POSTGRES ? pgSchema.deckLogHourly : undefined as any;
export const deckLogWatch = IS_POSTGRES ? pgSchema.deckLogWatch : undefined as any;
export const deckLogEvents = IS_POSTGRES ? pgSchema.deckLogEvents : undefined as any;

// Digital Engine Room Logbook
export const engineLogDaily = IS_POSTGRES ? pgSchema.engineLogDaily : undefined as any;
export const engineLogHourly = IS_POSTGRES ? pgSchema.engineLogHourly : undefined as any;
export const engineLogGenerator = IS_POSTGRES ? pgSchema.engineLogGenerator : undefined as any;
export const engineLogWatch = IS_POSTGRES ? pgSchema.engineLogWatch : undefined as any;
export const engineLogEvents = IS_POSTGRES ? pgSchema.engineLogEvents : undefined as any;

// Compliance Rules Engine
export const complianceFindings = IS_POSTGRES ? pgSchema.complianceFindings : undefined as any;
export const complianceRules = IS_POSTGRES ? pgSchema.complianceRules : undefined as any;

// Notification System
export const notificationSettings = IS_POSTGRES ? pgSchema.notificationSettings : undefined as any;
export const notificationQueue = IS_POSTGRES ? pgSchema.notificationQueue : undefined as any;

// StormGeo Integration
export const stormgeoSettings = IS_POSTGRES ? pgSchema.stormgeoSettings : undefined as any;
export const stormgeoSnapshots = IS_POSTGRES ? pgSchema.stormgeoSnapshots : undefined as any;
export const deckLogHourlyAutoFill = IS_POSTGRES ? pgSchema.deckLogHourlyAutoFill : undefined as any;
export const stormgeoImportHistory = IS_POSTGRES ? pgSchema.stormgeoImportHistory : undefined as any;

// External Data Cache (AI Copilot - cloud-only)
export const externalDataCache = IS_POSTGRES ? pgSchema.externalDataCache : undefined as any;

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
  insertDeckLogDailySchema,
  insertDeckLogHourlySchema,
  insertDeckLogWatchSchema,
  insertDeckLogEventsSchema,
  DECK_LOG_EVENT_TYPES,
  DECK_LOG_EVENT_SOURCES,
  // Select Schemas (only 2 exist)
  selectSensorTemplateSchema,
  selectSensorBundleSchema,
  // Standalone Zod Schemas (not tied to Drizzle tables) - 50 total
  adminPasswordChangeSchema,
  adminPasswordVerifySchema,
  adminSessionResponseSchema,
  bulkSensorConfigItemSchema,
  bulkSensorConfigSchema,
  costSavingsCalculateOptionsSchema,
  costSavingsListQuerySchema,
  costSavingsSummaryQuerySchema,
  costSavingsTrendQuerySchema,
  updateValidationStatusSchema,
  validationStatusEnum,
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
} from "./schema";

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
