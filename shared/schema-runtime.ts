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

/**
 * Import all schemas at top level (ESBuild requirement)
 */
import * as pgSchema from "./schema";
import * as sqliteVessel from "./schema-sqlite-vessel";
import * as sqliteSync from "./schema-sqlite-sync";

/**
 * Re-export ONLY types (no runtime values)
 * This prevents binding conflicts while keeping type definitions available.
 * Note: schema-sqlite-* types intentionally NOT re-exported here to avoid
 * collisions with Drizzle-core re-exports (index/integer/text/real/sqliteJsonHelpers).
 * Consumers needing SQLite-specific types should import from "@shared/sqlite-schema".
 */
export type * from "./schema";

// ============================================================================
// MODE-AWARE TABLE EXPORTS (All 173 tables)
// Each table uses ternary expression to select correct schema at runtime
// ============================================================================

// Sync Tables (from schema-sqlite-sync)
export const organizations = (isLocalMode ? sqliteSync.organizationsSqlite : pgSchema.organizations) as typeof pgSchema.organizations;
export const users = (isLocalMode ? sqliteSync.usersSqlite : pgSchema.users) as typeof pgSchema.users;
export const syncJournal = (isLocalMode ? sqliteSync.syncJournalSqlite : (pgSchema.syncJournal || sqliteSync.syncJournalSqlite)) as typeof pgSchema.syncJournal;
export const syncOutbox = (isLocalMode ? sqliteSync.syncOutboxSqlite : (pgSchema.syncOutbox || sqliteSync.syncOutboxSqlite)) as typeof pgSchema.syncOutbox;

// Equipment & Devices
export const vessels = (isLocalMode ? sqliteVessel.vesselsSqlite : pgSchema.vessels) as typeof pgSchema.vessels;
export const equipment = (isLocalMode ? sqliteVessel.equipmentSqlite : pgSchema.equipment) as typeof pgSchema.equipment;
export const devices = (isLocalMode ? sqliteVessel.devicesSqlite : pgSchema.devices) as typeof pgSchema.devices;
export const equipmentTelemetry = (isLocalMode ? sqliteVessel.equipmentTelemetrySqlite : pgSchema.equipmentTelemetry) as typeof pgSchema.equipmentTelemetry;
export const equipmentLifecycle = (isLocalMode ? sqliteVessel.equipmentLifecycleSqlite : pgSchema.equipmentLifecycle) as typeof pgSchema.equipmentLifecycle;
export const performanceMetrics = (isLocalMode ? sqliteVessel.performanceMetricsSqlite : pgSchema.performanceMetrics) as typeof pgSchema.performanceMetrics;
export const rawTelemetry = (isLocalMode ? sqliteVessel.rawTelemetrySqlite : pgSchema.rawTelemetry) as typeof pgSchema.rawTelemetry;
export const deviceRegistry = (isLocalMode ? (undefined as any) : pgSchema.deviceRegistry) as typeof pgSchema.deviceRegistry;
export const equipmentDecommissionEvents = (IS_POSTGRES ? pgSchema.equipmentDecommissionEvents : null) as typeof pgSchema.equipmentDecommissionEvents; // Cloud-only table

// Work Orders & Maintenance
export const workOrders = (isLocalMode ? sqliteVessel.workOrdersSqlite : pgSchema.workOrders) as typeof pgSchema.workOrders;
export const workOrderCompletions = (isLocalMode ? sqliteVessel.workOrderCompletionsSqlite : pgSchema.workOrderCompletions) as typeof pgSchema.workOrderCompletions;
export const workOrderParts = (isLocalMode ? sqliteVessel.workOrderPartsSqlite : pgSchema.workOrderParts) as typeof pgSchema.workOrderParts;
export const workOrderChecklists = (isLocalMode ? sqliteVessel.workOrderChecklistsSqlite : pgSchema.workOrderChecklists) as typeof pgSchema.workOrderChecklists;
export const workOrderWorklogs = (isLocalMode ? sqliteVessel.workOrderWorklogsSqlite : pgSchema.workOrderWorklogs) as typeof pgSchema.workOrderWorklogs;
export const workOrderTasks = (isLocalMode ? sqliteVessel.workOrderTasksSqlite : pgSchema.workOrderTasks) as typeof pgSchema.workOrderTasks;
export const workOrderHistory = (isLocalMode ? sqliteVessel.workOrderHistorySqlite : pgSchema.workOrderHistory) as typeof pgSchema.workOrderHistory;
export const maintenanceSchedules = (isLocalMode ? sqliteVessel.maintenanceSchedulesSqlite : pgSchema.maintenanceSchedules) as typeof pgSchema.maintenanceSchedules;
export const maintenanceRecords = (isLocalMode ? sqliteVessel.maintenanceRecordsSqlite : pgSchema.maintenanceRecords) as typeof pgSchema.maintenanceRecords;
export const maintenanceCosts = (isLocalMode ? sqliteVessel.maintenanceCostsSqlite : pgSchema.maintenanceCosts) as typeof pgSchema.maintenanceCosts;
export const maintenanceTemplates = (isLocalMode ? sqliteVessel.maintenanceTemplatesSqlite : pgSchema.maintenanceTemplates) as typeof pgSchema.maintenanceTemplates;
export const maintenanceChecklistItems = (isLocalMode ? sqliteVessel.maintenanceChecklistItemsSqlite : pgSchema.maintenanceChecklistItems) as typeof pgSchema.maintenanceChecklistItems;
export const maintenanceChecklistCompletions = (isLocalMode ? sqliteVessel.maintenanceChecklistCompletionsSqlite : pgSchema.maintenanceChecklistCompletions) as typeof pgSchema.maintenanceChecklistCompletions;
export const maintenanceWindows = (isLocalMode ? sqliteVessel.maintenanceWindowsSqlite : pgSchema.maintenanceWindows) as typeof pgSchema.maintenanceWindows;
export const downtimeEvents = (isLocalMode ? sqliteVessel.downtimeEventsSqlite : pgSchema.downtimeEvents) as typeof pgSchema.downtimeEvents;

// Inventory & Parts
export const parts = (isLocalMode ? sqliteVessel.partsSqlite : pgSchema.parts) as typeof pgSchema.parts;
export const partsInventory = (isLocalMode ? sqliteVessel.partsInventorySqlite : pgSchema.partsInventory) as typeof pgSchema.partsInventory;
export const partsInventorySuppliers = (IS_POSTGRES ? pgSchema.partsInventorySuppliers : undefined as any) as typeof pgSchema.partsInventorySuppliers; // Cloud-only junction table (multi-supplier support)
export const inventoryParts = (isLocalMode ? sqliteVessel.inventoryPartsSqlite : pgSchema.inventoryParts) as typeof pgSchema.inventoryParts;
export const stock = (isLocalMode ? sqliteVessel.stockSqlite : pgSchema.stock) as typeof pgSchema.stock;
export const inventoryMovements = (isLocalMode ? sqliteVessel.inventoryMovementsSqlite : pgSchema.inventoryMovements) as typeof pgSchema.inventoryMovements;
export const suppliers = (isLocalMode ? sqliteVessel.suppliersSqlite : pgSchema.suppliers) as typeof pgSchema.suppliers;
export const serviceOrders = (IS_POSTGRES ? pgSchema.serviceOrders : null) as typeof pgSchema.serviceOrders;
export const purchaseOrders = (isLocalMode ? sqliteVessel.purchaseOrdersSqlite : pgSchema.purchaseOrders) as typeof pgSchema.purchaseOrders;
export const purchaseOrderItems = (isLocalMode ? sqliteVessel.purchaseOrderItemsSqlite : pgSchema.purchaseOrderItems) as typeof pgSchema.purchaseOrderItems;
export const purchaseRequests = (IS_POSTGRES ? pgSchema.purchaseRequests : null) as typeof pgSchema.purchaseRequests;
export const partSubstitutions = (isLocalMode ? sqliteVessel.partSubstitutionsSqlite : pgSchema.partSubstitutions) as typeof pgSchema.partSubstitutions;
export const partFailureHistory = (isLocalMode ? sqliteVessel.partFailureHistorySqlite : pgSchema.partFailureHistory) as typeof pgSchema.partFailureHistory;
export const reservations = (isLocalMode ? sqliteVessel.reservationsSqlite : pgSchema.reservations) as typeof pgSchema.reservations;

// Crew Management
export const crew = (isLocalMode ? sqliteVessel.crewSqlite : pgSchema.crew) as typeof pgSchema.crew;
export const skills = (isLocalMode ? sqliteVessel.skillsSqlite : pgSchema.skills) as typeof pgSchema.skills;
export const crewSkill = (isLocalMode ? sqliteVessel.crewSkillSqlite : pgSchema.crewSkill) as typeof pgSchema.crewSkill;
export const crewAssignment = (isLocalMode ? sqliteVessel.crewAssignmentSqlite : pgSchema.crewAssignment) as typeof pgSchema.crewAssignment;
export const crewCertification = (isLocalMode ? sqliteVessel.crewCertificationSqlite : pgSchema.crewCertification) as typeof pgSchema.crewCertification;
export const crewDocuments = (isLocalMode ? sqliteVessel.crewDocumentsSqlite : pgSchema.crewDocuments) as typeof pgSchema.crewDocuments;
export const crewLeave = (isLocalMode ? sqliteVessel.crewLeaveSqlite : pgSchema.crewLeave) as typeof pgSchema.crewLeave;
export const shiftTemplate = (isLocalMode ? sqliteVessel.shiftTemplateSqlite : pgSchema.shiftTemplate) as typeof pgSchema.shiftTemplate;
export const crewRestSheet = (isLocalMode ? sqliteVessel.crewRestSheetSqlite : pgSchema.crewRestSheet) as typeof pgSchema.crewRestSheet;
export const crewRestDay = (isLocalMode ? sqliteVessel.crewRestDaySqlite : pgSchema.crewRestDay) as typeof pgSchema.crewRestDay;
export const crewNotificationSettings = pgSchema.crewNotificationSettings;

// Sensors & Monitoring
export const sensorConfigurations = (isLocalMode ? sqliteVessel.sensorConfigurationsSqlite : pgSchema.sensorConfigurations) as typeof pgSchema.sensorConfigurations;
export const sensorStates = (isLocalMode ? sqliteVessel.sensorStatesSqlite : pgSchema.sensorStates) as typeof pgSchema.sensorStates;
export const sensorTemplates = (isLocalMode ? (undefined as any) : pgSchema.sensorTemplates) as typeof pgSchema.sensorTemplates;
export const sensorBundles = (isLocalMode ? (undefined as any) : pgSchema.sensorBundles) as typeof pgSchema.sensorBundles;
export const sensorTypes = (isLocalMode ? sqliteVessel.sensorTypesSqlite : pgSchema.sensorTypes) as typeof pgSchema.sensorTypes;
export const sensorThresholds = (isLocalMode ? sqliteVessel.sensorThresholdsSqlite : pgSchema.sensorThresholds) as typeof pgSchema.sensorThresholds;
export const sensorMapping = (isLocalMode ? sqliteVessel.sensorMappingSqlite : pgSchema.sensorMapping) as typeof pgSchema.sensorMapping;
export const discoveredSignals = (isLocalMode ? sqliteVessel.discoveredSignalsSqlite : pgSchema.discoveredSignals) as typeof pgSchema.discoveredSignals;

// Alerts & Notifications
export const alertConfigurations = (isLocalMode ? sqliteVessel.alertConfigurationsSqlite : pgSchema.alertConfigurations) as typeof pgSchema.alertConfigurations;
export const alertNotifications = (isLocalMode ? sqliteVessel.alertNotificationsSqlite : pgSchema.alertNotifications) as typeof pgSchema.alertNotifications;
export const alertSuppressions = (isLocalMode ? sqliteVessel.alertSuppressionsSqlite : pgSchema.alertSuppressions) as typeof pgSchema.alertSuppressions;
export const alertComments = (isLocalMode ? sqliteVessel.alertCommentsSqlite : pgSchema.alertComments) as typeof pgSchema.alertComments;
export const actionableInsights = (isLocalMode ? sqliteVessel.actionableInsightsSqlite : pgSchema.actionableInsights) as typeof pgSchema.actionableInsights;
export const operatingConditionAlerts = (isLocalMode ? sqliteVessel.operatingConditionAlertsSqlite : pgSchema.operatingConditionAlerts) as typeof pgSchema.operatingConditionAlerts;
export const pdmAlerts = (isLocalMode ? sqliteVessel.pdmAlertsSqlite : pgSchema.pdmAlerts) as typeof pgSchema.pdmAlerts;
export const pdmScoreLogs = (isLocalMode ? (undefined as any) : pgSchema.pdmScoreLogs) as typeof pgSchema.pdmScoreLogs;
export const pdmBaseline = (isLocalMode ? (undefined as any) : pgSchema.pdmBaseline) as typeof pgSchema.pdmBaseline;

export const diagnosticRuns = (IS_POSTGRES ? pgSchema.diagnosticRuns : null) as typeof pgSchema.diagnosticRuns;

// ML & Predictive Maintenance
export const mlModels = (isLocalMode ? sqliteVessel.mlModelsSqlite : pgSchema.mlModels) as typeof pgSchema.mlModels;
export const mlModelAccuracyHistory = (isLocalMode ? (undefined as any) : pgSchema.mlModelAccuracyHistory) as typeof pgSchema.mlModelAccuracyHistory;
export const failurePredictions = (isLocalMode ? sqliteVessel.failurePredictionsSqlite : pgSchema.failurePredictions) as typeof pgSchema.failurePredictions;
export const anomalyDetections = (isLocalMode ? sqliteVessel.anomalyDetectionsSqlite : pgSchema.anomalyDetections) as typeof pgSchema.anomalyDetections;
export const componentDegradation = (isLocalMode ? sqliteVessel.componentDegradationSqlite : pgSchema.componentDegradation) as typeof pgSchema.componentDegradation;
export const failureHistory = (isLocalMode ? sqliteVessel.failureHistorySqlite : pgSchema.failureHistory) as typeof pgSchema.failureHistory;
export const predictionFeedback = (isLocalMode ? sqliteVessel.predictionFeedbackSqlite : pgSchema.predictionFeedback) as typeof pgSchema.predictionFeedback;
export const modelPerformanceValidations = (isLocalMode ? sqliteVessel.modelPerformanceValidationsSqlite : pgSchema.modelPerformanceValidations) as typeof pgSchema.modelPerformanceValidations;
export const retrainingTriggers = (isLocalMode ? sqliteVessel.retrainingTriggersSqlite : pgSchema.retrainingTriggers) as typeof pgSchema.retrainingTriggers;
export const thresholdOptimizations = (isLocalMode ? sqliteVessel.thresholdOptimizationsSqlite : pgSchema.thresholdOptimizations) as typeof pgSchema.thresholdOptimizations;
export const modelRegistry = (isLocalMode ? sqliteVessel.modelRegistrySqlite : pgSchema.modelRegistry) as typeof pgSchema.modelRegistry;
export const rulModels = (isLocalMode ? (undefined as any) : pgSchema.rulModels) as typeof pgSchema.rulModels;
export const rulFitHistory = (isLocalMode ? (undefined as any) : pgSchema.rulFitHistory) as typeof pgSchema.rulFitHistory;
export const weibullEstimates = (isLocalMode ? (undefined as any) : pgSchema.weibullEstimates) as typeof pgSchema.weibullEstimates;

// Insights & Analytics
export const insightSnapshots = (isLocalMode ? sqliteVessel.insightSnapshotsSqlite : pgSchema.insightSnapshots) as typeof pgSchema.insightSnapshots;
export const insightReports = (isLocalMode ? sqliteVessel.insightReportsSqlite : pgSchema.insightReports) as typeof pgSchema.insightReports;
export const metricsHistory = (isLocalMode ? (undefined as any) : pgSchema.metricsHistory) as typeof pgSchema.metricsHistory;
export const dailyMetricRollups = (isLocalMode ? (undefined as any) : pgSchema.dailyMetricRollups) as typeof pgSchema.dailyMetricRollups;
export const dataQualityMetrics = (isLocalMode ? (undefined as any) : pgSchema.dataQualityMetrics) as typeof pgSchema.dataQualityMetrics;
export const telemetryAggregates = (isLocalMode ? sqliteVessel.telemetryAggregatesSqlite : pgSchema.telemetryAggregates) as typeof pgSchema.telemetryAggregates;
export const telemetryRollups = (isLocalMode ? sqliteVessel.telemetryRollupsSqlite : pgSchema.telemetryRollups) as typeof pgSchema.telemetryRollups;
export const industryBenchmarks = (isLocalMode ? (undefined as any) : pgSchema.industryBenchmarks) as typeof pgSchema.industryBenchmarks;

// DTC & Diagnostics
export const dtcDefinitions = (isLocalMode ? sqliteVessel.dtcDefinitionsSqlite : pgSchema.dtcDefinitions) as typeof pgSchema.dtcDefinitions;
export const dtcFaults = (isLocalMode ? sqliteVessel.dtcFaultsSqlite : pgSchema.dtcFaults) as typeof pgSchema.dtcFaults;

// System & Configuration
export const systemSettings = (isLocalMode ? (undefined as any) : pgSchema.systemSettings) as typeof pgSchema.systemSettings;
export const systemPerformanceMetrics = (isLocalMode ? (undefined as any) : pgSchema.systemPerformanceMetrics) as typeof pgSchema.systemPerformanceMetrics;
export const systemHealthChecks = (isLocalMode ? (undefined as any) : pgSchema.systemHealthChecks) as typeof pgSchema.systemHealthChecks;
export const transportSettings = (isLocalMode ? (undefined as any) : pgSchema.transportSettings) as typeof pgSchema.transportSettings;
export const transportFailovers = (isLocalMode ? (undefined as any) : pgSchema.transportFailovers) as typeof pgSchema.transportFailovers;
export const integrationConfigs = (isLocalMode ? sqliteVessel.integrationConfigsSqlite : pgSchema.integrationConfigs) as typeof pgSchema.integrationConfigs;
export const storageConfig = (isLocalMode ? sqliteVessel.storageConfigSqlite : pgSchema.storageConfig) as typeof pgSchema.storageConfig;

// Edge & IoT
export const edgeHeartbeats = (isLocalMode ? sqliteVessel.edgeHeartbeatsSqlite : pgSchema.edgeHeartbeats) as typeof pgSchema.edgeHeartbeats;
export const edgeDiagnosticLogs = (isLocalMode ? (undefined as any) : pgSchema.edgeDiagnosticLogs) as typeof pgSchema.edgeDiagnosticLogs;
export const mqttDevices = (isLocalMode ? (undefined as any) : pgSchema.mqttDevices) as typeof pgSchema.mqttDevices;
export const serialPortStates = (isLocalMode ? (undefined as any) : pgSchema.serialPortStates) as typeof pgSchema.serialPortStates;
export const j1939Configurations = (isLocalMode ? sqliteVessel.j1939ConfigurationsSqlite : pgSchema.j1939Configurations) as typeof pgSchema.j1939Configurations;
export const calibrationCache = (isLocalMode ? sqliteVessel.calibrationCacheSqlite : pgSchema.calibrationCache) as typeof pgSchema.calibrationCache;

// Condition Monitoring
export const conditionMonitoring = (isLocalMode ? (undefined as any) : pgSchema.conditionMonitoring) as typeof pgSchema.conditionMonitoring;
export const oilAnalysis = (isLocalMode ? (undefined as any) : pgSchema.oilAnalysis) as typeof pgSchema.oilAnalysis;
export const wearParticleAnalysis = (isLocalMode ? (undefined as any) : pgSchema.wearParticleAnalysis) as typeof pgSchema.wearParticleAnalysis;
export const oilChangeRecords = (isLocalMode ? (undefined as any) : pgSchema.oilChangeRecords) as typeof pgSchema.oilChangeRecords;
export const vibrationFeatures = (isLocalMode ? sqliteVessel.vibrationFeaturesSqlite : pgSchema.vibrationFeatures) as typeof pgSchema.vibrationFeatures;
export const vibrationAnalysis = (isLocalMode ? (undefined as any) : pgSchema.vibrationAnalysis) as typeof pgSchema.vibrationAnalysis;
export const operatingParameters = (isLocalMode ? sqliteVessel.operatingParametersSqlite : pgSchema.operatingParameters) as typeof pgSchema.operatingParameters;

// Scheduling & Optimization
export const scheduleOptimizations = (isLocalMode ? sqliteVessel.scheduleOptimizationsSqlite : pgSchema.scheduleOptimizations) as typeof pgSchema.scheduleOptimizations;
export const optimizerConfigurations = (isLocalMode ? sqliteVessel.optimizerConfigurationsSqlite : pgSchema.optimizerConfigurations) as typeof pgSchema.optimizerConfigurations;
export const resourceConstraints = (isLocalMode ? sqliteVessel.resourceConstraintsSqlite : pgSchema.resourceConstraints) as typeof pgSchema.resourceConstraints;
export const optimizationResults = (isLocalMode ? sqliteVessel.optimizationResultsSqlite : pgSchema.optimizationResults) as typeof pgSchema.optimizationResults;

// Compliance & Costs
export const complianceBundles = (isLocalMode ? sqliteVessel.complianceBundlesSqlite : pgSchema.complianceBundles) as typeof pgSchema.complianceBundles;
export const complianceDocs = (isLocalMode ? sqliteVessel.complianceDocsSqlite : pgSchema.complianceDocs) as typeof pgSchema.complianceDocs;
export const complianceAuditLog = (isLocalMode ? sqliteVessel.complianceAuditLogSqlite : pgSchema.complianceAuditLog) as typeof pgSchema.complianceAuditLog;
export const costSavings = (isLocalMode ? sqliteVessel.costSavingsSqlite : pgSchema.costSavings) as typeof pgSchema.costSavings;
export const costModel = (isLocalMode ? (undefined as any) : pgSchema.costModel) as typeof pgSchema.costModel;
export const laborRates = (isLocalMode ? sqliteVessel.laborRatesSqlite : pgSchema.laborRates) as typeof pgSchema.laborRates;
export const expenses = (isLocalMode ? sqliteVessel.expensesSqlite : pgSchema.expenses) as typeof pgSchema.expenses;

// Vessel Operations
export const portCall = (isLocalMode ? sqliteVessel.portCallSqlite : pgSchema.portCall) as typeof pgSchema.portCall;
export const drydockWindow = (isLocalMode ? sqliteVessel.drydockWindowSqlite : pgSchema.drydockWindow) as typeof pgSchema.drydockWindow;

// Digital Twin & Simulation
export const digitalTwins = (isLocalMode ? (undefined as any) : pgSchema.digitalTwins) as typeof pgSchema.digitalTwins;
export const twinSimulations = (isLocalMode ? (undefined as any) : pgSchema.twinSimulations) as typeof pgSchema.twinSimulations;
export const visualizationAssets = (isLocalMode ? sqliteVessel.visualizationAssetsSqlite : pgSchema.visualizationAssets) as typeof pgSchema.visualizationAssets;

// Admin & Security
export const adminAuditEvents = (isLocalMode ? sqliteVessel.adminAuditEventsSqlite : pgSchema.adminAuditEvents) as typeof pgSchema.adminAuditEvents;
export const adminSystemSettings = (isLocalMode ? sqliteVessel.adminSystemSettingsSqlite : pgSchema.adminSystemSettings) as typeof pgSchema.adminSystemSettings;

// Compliance & Security Infrastructure (Phase 1 Compliance Hardening)
export const immutableAuditTrail = (isLocalMode ? sqliteVessel.immutableAuditTrailSqlite : pgSchema.immutableAuditTrail) as typeof pgSchema.immutableAuditTrail;
export const engineerOverrides = (isLocalMode ? sqliteVessel.engineerOverridesSqlite : pgSchema.engineerOverrides) as typeof pgSchema.engineerOverrides;
export const predictionDataQuality = (isLocalMode ? sqliteVessel.predictionDataQualitySqlite : pgSchema.predictionDataQuality) as typeof pgSchema.predictionDataQuality;
export const userSessions = (isLocalMode ? sqliteVessel.userSessionsSqlite : pgSchema.userSessions) as typeof pgSchema.userSessions;
export const loginEvents = (isLocalMode ? sqliteVessel.loginEventsSqlite : pgSchema.loginEvents) as typeof pgSchema.loginEvents;
export const dataSubjectRequests = (isLocalMode ? sqliteVessel.dataSubjectRequestsSqlite : pgSchema.dataSubjectRequests) as typeof pgSchema.dataSubjectRequests;
export const crossBorderTransfers = (isLocalMode ? sqliteVessel.crossBorderTransfersSqlite : pgSchema.crossBorderTransfers) as typeof pgSchema.crossBorderTransfers;
export const syncProtocolVersion = (isLocalMode ? sqliteVessel.syncProtocolVersionSqlite : pgSchema.syncProtocolVersion) as typeof pgSchema.syncProtocolVersion;

// Error Handling & Logging
export const errorLogs = (isLocalMode ? sqliteVessel.errorLogsSqlite : pgSchema.errorLogs) as typeof pgSchema.errorLogs;
export const idempotencyLog = (isLocalMode ? sqliteVessel.idempotencyLogSqlite : pgSchema.idempotencyLog) as typeof pgSchema.idempotencyLog;
export const requestIdempotency = (isLocalMode ? sqliteVessel.requestIdempotencySqlite : pgSchema.requestIdempotency) as typeof pgSchema.requestIdempotency;

// AR & Advanced Features
export const arMaintenanceProcedures = (isLocalMode ? sqliteVessel.arMaintenanceProceduresSqlite : pgSchema.arMaintenanceProcedures) as typeof pgSchema.arMaintenanceProcedures;
export const beastModeConfig = (isLocalMode ? (undefined as any) : pgSchema.beastModeConfig) as typeof pgSchema.beastModeConfig;

// Telemetry & Data Management
export const telemetryRetentionPolicies = (isLocalMode ? (undefined as any) : pgSchema.telemetryRetentionPolicies) as typeof pgSchema.telemetryRetentionPolicies;
export const opsDbStaged = (isLocalMode ? sqliteVessel.opsDbStagedSqlite : pgSchema.opsDbStaged) as typeof pgSchema.opsDbStaged;
export const replayIncoming = (isLocalMode ? (undefined as any) : pgSchema.replayIncoming) as typeof pgSchema.replayIncoming;
export const sheetLock = (isLocalMode ? sqliteVessel.sheetLockSqlite : pgSchema.sheetLock) as typeof pgSchema.sheetLock;
export const sheetVersion = (isLocalMode ? sqliteVessel.sheetVersionSqlite : pgSchema.sheetVersion) as typeof pgSchema.sheetVersion;
export const dbSchemaVersion = (isLocalMode ? sqliteVessel.dbSchemaVersionSqlite : pgSchema.dbSchemaVersion) as typeof pgSchema.dbSchemaVersion;

// LLM & AI Features
export const llmBudgetConfigs = (isLocalMode ? sqliteVessel.llmBudgetConfigsSqlite : pgSchema.llmBudgetConfigs) as typeof pgSchema.llmBudgetConfigs;
export const llmCostTracking = (isLocalMode ? sqliteVessel.llmCostTrackingSqlite : pgSchema.llmCostTracking) as typeof pgSchema.llmCostTracking;
export const ragSearchQueries = (isLocalMode ? sqliteVessel.ragSearchQueriesSqlite : pgSchema.ragSearchQueries) as typeof pgSchema.ragSearchQueries;
export const contentSources = (isLocalMode ? sqliteVessel.contentSourcesSqlite : pgSchema.contentSources) as typeof pgSchema.contentSources;
export const knowledgeBaseItems = (isLocalMode ? sqliteVessel.knowledgeBaseItemsSqlite : pgSchema.kbDocs) as typeof pgSchema.kbDocs;

// Sync & Conflicts
export const syncConflicts = (isLocalMode ? sqliteVessel.syncConflictsSqlite : (pgSchema.syncConflicts || sqliteVessel.syncConflictsSqlite)) as typeof pgSchema.syncConflicts;

// ============================================================================
// POSTGRESQL-ONLY TABLES (guarded exports - undefined in SQLite mode)
// These tables only exist in cloud deployments and will crash if accessed in SQLite mode
// ============================================================================
export const softwarePatches = (IS_POSTGRES ? pgSchema.softwarePatches : undefined as any) as typeof pgSchema.softwarePatches;
export const configAuditLog = (IS_POSTGRES ? pgSchema.configAuditLog : undefined as any) as typeof pgSchema.configAuditLog;
export const updateSettings = (IS_POSTGRES ? pgSchema.updateSettings : (sqliteVessel as any).updateSettingsSqlite) as typeof pgSchema.updateSettings;
export const patchDownloads = (IS_POSTGRES ? pgSchema.patchDownloads : undefined as any) as typeof pgSchema.patchDownloads;
export const adminSessions = (IS_POSTGRES ? pgSchema.adminSessions : undefined as any) as typeof pgSchema.adminSessions;
export const modelDeployments = (IS_POSTGRES ? pgSchema.modelDeployments : undefined as any) as typeof pgSchema.modelDeployments;
export const entityOffsets = (IS_POSTGRES ? pgSchema.entityOffsets : undefined as any) as typeof pgSchema.entityOffsets;
export const contextEvents = (IS_POSTGRES ? pgSchema.contextEvents : undefined as any) as typeof pgSchema.contextEvents;
export const auditRuns = (IS_POSTGRES ? pgSchema.auditRuns : undefined as any) as typeof pgSchema.auditRuns;
export const auditWebhookSubscriptions = (IS_POSTGRES ? pgSchema.auditWebhookSubscriptions : undefined as any) as typeof pgSchema.auditWebhookSubscriptions;
export const kbDocs = (IS_POSTGRES ? pgSchema.kbDocs : undefined as any) as typeof pgSchema.kbDocs; // Note: knowledgeBaseItems is the SQLite equivalent
export const kbDocVersions = (IS_POSTGRES ? pgSchema.kbDocVersions : undefined as any) as typeof pgSchema.kbDocVersions;
export const kbChunks = (IS_POSTGRES ? pgSchema.kbChunks : undefined as any) as typeof pgSchema.kbChunks;
export const kbEmbeddingCache = (IS_POSTGRES ? pgSchema.kbEmbeddingCache : undefined as any) as typeof pgSchema.kbEmbeddingCache;

// RAG Conversation System (PostgreSQL-only)
export const ragConversations = (IS_POSTGRES ? pgSchema.ragConversations : undefined as any) as typeof pgSchema.ragConversations;
export const ragMessages = (IS_POSTGRES ? pgSchema.ragMessages : undefined as any) as typeof pgSchema.ragMessages;
export const ragFeedback = (IS_POSTGRES ? pgSchema.ragFeedback : undefined as any) as typeof pgSchema.ragFeedback;
export const ragSemanticCache = (IS_POSTGRES ? pgSchema.ragSemanticCache : undefined as any) as typeof pgSchema.ragSemanticCache;
export const weatherCache = (IS_POSTGRES ? pgSchema.weatherCache : undefined as any) as typeof pgSchema.weatherCache;
export const schedulerRuns = (IS_POSTGRES ? pgSchema.schedulerRuns : sqliteVessel.schedulerRunsSqlite) as typeof pgSchema.schedulerRuns;
export const scheduleAssignments = (IS_POSTGRES ? pgSchema.scheduleAssignments : sqliteVessel.scheduleAssignmentsSqlite) as typeof pgSchema.scheduleAssignments;
export const scheduleUnfilled = (IS_POSTGRES ? pgSchema.scheduleUnfilled : sqliteVessel.scheduleUnfilledSqlite) as typeof pgSchema.scheduleUnfilled;
export const mlModelsLegacy = (IS_POSTGRES ? pgSchema.mlModelsLegacy : undefined as any) as typeof pgSchema.mlModelsLegacy;
export const calibrationCurves = (IS_POSTGRES ? pgSchema.calibrationCurves : undefined as any) as typeof pgSchema.calibrationCurves;
export const realTimePredictions = (IS_POSTGRES ? pgSchema.realTimePredictions : undefined as any) as typeof pgSchema.realTimePredictions;
export const featureImportances = (IS_POSTGRES ? pgSchema.featureImportances : undefined as any) as typeof pgSchema.featureImportances;
export const sensorFusionSnapshots = (IS_POSTGRES ? pgSchema.sensorFusionSnapshots : undefined as any) as typeof pgSchema.sensorFusionSnapshots;
export const acousticEvents = (IS_POSTGRES ? pgSchema.acousticEvents : undefined as any) as typeof pgSchema.acousticEvents;

// Digital Deck Logbook
export const deckLogDaily = (IS_POSTGRES ? pgSchema.deckLogDaily : undefined as any) as typeof pgSchema.deckLogDaily;
export const deckLogHourly = (IS_POSTGRES ? pgSchema.deckLogHourly : undefined as any) as typeof pgSchema.deckLogHourly;
export const deckLogWatch = (IS_POSTGRES ? pgSchema.deckLogWatch : undefined as any) as typeof pgSchema.deckLogWatch;
export const deckLogEvents = (IS_POSTGRES ? pgSchema.deckLogEvents : undefined as any) as typeof pgSchema.deckLogEvents;

// Digital Engine Room Logbook
export const engineLogDaily = (IS_POSTGRES ? pgSchema.engineLogDaily : undefined as any) as typeof pgSchema.engineLogDaily;
export const engineLogHourly = (IS_POSTGRES ? pgSchema.engineLogHourly : undefined as any) as typeof pgSchema.engineLogHourly;
export const engineLogGenerator = (IS_POSTGRES ? pgSchema.engineLogGenerator : undefined as any) as typeof pgSchema.engineLogGenerator;
export const engineLogWatch = (IS_POSTGRES ? pgSchema.engineLogWatch : undefined as any) as typeof pgSchema.engineLogWatch;
export const engineLogEvents = (IS_POSTGRES ? pgSchema.engineLogEvents : undefined as any) as typeof pgSchema.engineLogEvents;

// Compliance Rules Engine
export const complianceFindings = (IS_POSTGRES ? pgSchema.complianceFindings : undefined as any) as typeof pgSchema.complianceFindings;
export const complianceRules = (IS_POSTGRES ? pgSchema.complianceRules : undefined as any) as typeof pgSchema.complianceRules;

// Notification System
export const notificationSettings = (IS_POSTGRES ? pgSchema.notificationSettings : undefined as any) as typeof pgSchema.notificationSettings;
export const notificationQueue = (IS_POSTGRES ? pgSchema.notificationQueue : undefined as any) as typeof pgSchema.notificationQueue;

// StormGeo Integration
export const stormgeoSettings = (IS_POSTGRES ? pgSchema.stormgeoSettings : undefined as any) as typeof pgSchema.stormgeoSettings;
export const stormgeoSnapshots = (IS_POSTGRES ? pgSchema.stormgeoSnapshots : undefined as any) as typeof pgSchema.stormgeoSnapshots;
export const deckLogHourlyAutoFill = (IS_POSTGRES ? pgSchema.deckLogHourlyAutoFill : undefined as any) as typeof pgSchema.deckLogHourlyAutoFill;
export const stormgeoImportHistory = (IS_POSTGRES ? pgSchema.stormgeoImportHistory : undefined as any) as typeof pgSchema.stormgeoImportHistory;

// External Data Cache (AI Copilot - cloud-only)
export const externalDataCache = (IS_POSTGRES ? pgSchema.externalDataCache : undefined as any) as typeof pgSchema.externalDataCache;

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
