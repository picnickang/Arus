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

// ============================================================================
// Schema-pick helpers — replace the dual-mode cast pattern
//   (cond ? A : B) as typeof pgSchema.X
// with type-safe selectors that compress 70+ escape-hatch / 'as typeof' casts.
//
// Both helpers are constrained to Drizzle's `Table` base class so the cast
// at the boundary is structurally bounded (sqlite/pg tables both extend
// `Table`). Consumers see the PG-shaped inferred insert/select types,
// which is the canonical contract across the codebase.
// ============================================================================
import type { Table } from "drizzle-orm";

function pickSchema<P extends Table>(useSqlite: boolean, sqliteTable: Table, pgTable: P): P {
  return useSqlite ? (sqliteTable as P) : pgTable;
}
/** Cloud-only table — present only in PostgreSQL mode; undefined in SQLite mode. */
function cloudOnly<P extends Table>(pgTable: P): P {
  if (isLocalMode) {
    return undefined as never;
  }
  return pgTable;
}


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
export const organizations = pickSchema(isLocalMode, sqliteSync.organizationsSqlite, pgSchema.organizations);
export const users = pickSchema(isLocalMode, sqliteSync.usersSqlite, pgSchema.users);
export const syncJournal = pickSchema(isLocalMode, sqliteSync.syncJournalSqlite, pgSchema.syncJournal);
export const syncOutbox = pickSchema(isLocalMode, sqliteSync.syncOutboxSqlite, pgSchema.syncOutbox);

// Equipment & Devices
export const vessels = pickSchema(isLocalMode, sqliteVessel.vesselsSqlite, pgSchema.vessels);
export const equipment = pickSchema(isLocalMode, sqliteVessel.equipmentSqlite, pgSchema.equipment);
export const devices = pickSchema(isLocalMode, sqliteVessel.devicesSqlite, pgSchema.devices);
export const equipmentTelemetry = pickSchema(isLocalMode, sqliteVessel.equipmentTelemetrySqlite, pgSchema.equipmentTelemetry);
export const equipmentLifecycle = pickSchema(isLocalMode, sqliteVessel.equipmentLifecycleSqlite, pgSchema.equipmentLifecycle);
export const performanceMetrics = pickSchema(isLocalMode, sqliteVessel.performanceMetricsSqlite, pgSchema.performanceMetrics);
export const rawTelemetry = pickSchema(isLocalMode, sqliteVessel.rawTelemetrySqlite, pgSchema.rawTelemetry);
export const deviceRegistry = cloudOnly(pgSchema.deviceRegistry);
export const equipmentDecommissionEvents = cloudOnly(pgSchema.equipmentDecommissionEvents); // Cloud-only table

// Work Orders & Maintenance
export const workOrders = pickSchema(isLocalMode, sqliteVessel.workOrdersSqlite, pgSchema.workOrders);
export const workOrderCompletions = pickSchema(isLocalMode, sqliteVessel.workOrderCompletionsSqlite, pgSchema.workOrderCompletions);
export const workOrderParts = pickSchema(isLocalMode, sqliteVessel.workOrderPartsSqlite, pgSchema.workOrderParts);
export const workOrderChecklists = pickSchema(isLocalMode, sqliteVessel.workOrderChecklistsSqlite, pgSchema.workOrderChecklists);
export const workOrderWorklogs = pickSchema(isLocalMode, sqliteVessel.workOrderWorklogsSqlite, pgSchema.workOrderWorklogs);
export const workOrderTasks = pickSchema(isLocalMode, sqliteVessel.workOrderTasksSqlite, pgSchema.workOrderTasks);
export const workOrderHistory = pickSchema(isLocalMode, sqliteVessel.workOrderHistorySqlite, pgSchema.workOrderHistory);
export const maintenanceSchedules = pickSchema(isLocalMode, sqliteVessel.maintenanceSchedulesSqlite, pgSchema.maintenanceSchedules);
export const maintenanceRecords = pickSchema(isLocalMode, sqliteVessel.maintenanceRecordsSqlite, pgSchema.maintenanceRecords);
export const maintenanceCosts = pickSchema(isLocalMode, sqliteVessel.maintenanceCostsSqlite, pgSchema.maintenanceCosts);
export const maintenanceTemplates = pickSchema(isLocalMode, sqliteVessel.maintenanceTemplatesSqlite, pgSchema.maintenanceTemplates);
export const maintenanceChecklistItems = pickSchema(isLocalMode, sqliteVessel.maintenanceChecklistItemsSqlite, pgSchema.maintenanceChecklistItems);
export const maintenanceChecklistCompletions = pickSchema(isLocalMode, sqliteVessel.maintenanceChecklistCompletionsSqlite, pgSchema.maintenanceChecklistCompletions);
export const maintenanceWindows = pickSchema(isLocalMode, sqliteVessel.maintenanceWindowsSqlite, pgSchema.maintenanceWindows);
export const downtimeEvents = pickSchema(isLocalMode, sqliteVessel.downtimeEventsSqlite, pgSchema.downtimeEvents);

// Inventory & Parts
export const parts = pickSchema(isLocalMode, sqliteVessel.partsSqlite, pgSchema.parts);
export const partsInventory = pickSchema(isLocalMode, sqliteVessel.partsInventorySqlite, pgSchema.partsInventory);
export const partsInventorySuppliers = cloudOnly(pgSchema.partsInventorySuppliers); // Cloud-only junction table (multi-supplier support)
export const inventoryParts = pickSchema(isLocalMode, sqliteVessel.inventoryPartsSqlite, pgSchema.inventoryParts);
export const stock = pickSchema(isLocalMode, sqliteVessel.stockSqlite, pgSchema.stock);
export const inventoryMovements = pickSchema(isLocalMode, sqliteVessel.inventoryMovementsSqlite, pgSchema.inventoryMovements);
export const suppliers = pickSchema(isLocalMode, sqliteVessel.suppliersSqlite, pgSchema.suppliers);
export const serviceOrders = cloudOnly(pgSchema.serviceOrders);
export const purchaseOrders = pickSchema(isLocalMode, sqliteVessel.purchaseOrdersSqlite, pgSchema.purchaseOrders);
export const purchaseOrderItems = pickSchema(isLocalMode, sqliteVessel.purchaseOrderItemsSqlite, pgSchema.purchaseOrderItems);
export const purchaseRequests = cloudOnly(pgSchema.purchaseRequests);
export const partSubstitutions = pickSchema(isLocalMode, sqliteVessel.partSubstitutionsSqlite, pgSchema.partSubstitutions);
export const partFailureHistory = pickSchema(isLocalMode, sqliteVessel.partFailureHistorySqlite, pgSchema.partFailureHistory);
export const reservations = pickSchema(isLocalMode, sqliteVessel.reservationsSqlite, pgSchema.reservations);

// Crew Management
export const crew = pickSchema(isLocalMode, sqliteVessel.crewSqlite, pgSchema.crew);
export const skills = pickSchema(isLocalMode, sqliteVessel.skillsSqlite, pgSchema.skills);
export const crewSkill = pickSchema(isLocalMode, sqliteVessel.crewSkillSqlite, pgSchema.crewSkill);
export const crewAssignment = pickSchema(isLocalMode, sqliteVessel.crewAssignmentSqlite, pgSchema.crewAssignment);
export const crewCertification = pickSchema(isLocalMode, sqliteVessel.crewCertificationSqlite, pgSchema.crewCertification);
export const crewDocuments = pickSchema(isLocalMode, sqliteVessel.crewDocumentsSqlite, pgSchema.crewDocuments);
export const crewLeave = pickSchema(isLocalMode, sqliteVessel.crewLeaveSqlite, pgSchema.crewLeave);
export const shiftTemplate = pickSchema(isLocalMode, sqliteVessel.shiftTemplateSqlite, pgSchema.shiftTemplate);
export const crewRestSheet = pickSchema(isLocalMode, sqliteVessel.crewRestSheetSqlite, pgSchema.crewRestSheet);
export const crewRestDay = pickSchema(isLocalMode, sqliteVessel.crewRestDaySqlite, pgSchema.crewRestDay);
export const crewNotificationSettings = pgSchema.crewNotificationSettings;

// Sensors & Monitoring
export const sensorConfigurations = pickSchema(isLocalMode, sqliteVessel.sensorConfigurationsSqlite, pgSchema.sensorConfigurations);
export const sensorStates = pickSchema(isLocalMode, sqliteVessel.sensorStatesSqlite, pgSchema.sensorStates);
export const sensorTemplates = cloudOnly(pgSchema.sensorTemplates);
export const sensorBundles = cloudOnly(pgSchema.sensorBundles);
export const sensorTypes = pickSchema(isLocalMode, sqliteVessel.sensorTypesSqlite, pgSchema.sensorTypes);
export const sensorThresholds = pickSchema(isLocalMode, sqliteVessel.sensorThresholdsSqlite, pgSchema.sensorThresholds);
export const sensorMapping = pickSchema(isLocalMode, sqliteVessel.sensorMappingSqlite, pgSchema.sensorMapping);
export const discoveredSignals = pickSchema(isLocalMode, sqliteVessel.discoveredSignalsSqlite, pgSchema.discoveredSignals);

// Alerts & Notifications
export const alertConfigurations = pickSchema(isLocalMode, sqliteVessel.alertConfigurationsSqlite, pgSchema.alertConfigurations);
export const alertNotifications = pickSchema(isLocalMode, sqliteVessel.alertNotificationsSqlite, pgSchema.alertNotifications);
export const alertSuppressions = pickSchema(isLocalMode, sqliteVessel.alertSuppressionsSqlite, pgSchema.alertSuppressions);
export const alertComments = pickSchema(isLocalMode, sqliteVessel.alertCommentsSqlite, pgSchema.alertComments);
export const actionableInsights = pickSchema(isLocalMode, sqliteVessel.actionableInsightsSqlite, pgSchema.actionableInsights);
export const operatingConditionAlerts = pickSchema(isLocalMode, sqliteVessel.operatingConditionAlertsSqlite, pgSchema.operatingConditionAlerts);
export const pdmAlerts = pickSchema(isLocalMode, sqliteVessel.pdmAlertsSqlite, pgSchema.pdmAlerts);
export const pdmScoreLogs = cloudOnly(pgSchema.pdmScoreLogs);
export const pdmBaseline = cloudOnly(pgSchema.pdmBaseline);

export const diagnosticRuns = cloudOnly(pgSchema.diagnosticRuns);

// ML & Predictive Maintenance
export const mlModels = pickSchema(isLocalMode, sqliteVessel.mlModelsSqlite, pgSchema.mlModels);
export const mlModelAccuracyHistory = cloudOnly(pgSchema.mlModelAccuracyHistory);
export const failurePredictions = pickSchema(isLocalMode, sqliteVessel.failurePredictionsSqlite, pgSchema.failurePredictions);
export const anomalyDetections = pickSchema(isLocalMode, sqliteVessel.anomalyDetectionsSqlite, pgSchema.anomalyDetections);
export const componentDegradation = pickSchema(isLocalMode, sqliteVessel.componentDegradationSqlite, pgSchema.componentDegradation);
export const failureHistory = pickSchema(isLocalMode, sqliteVessel.failureHistorySqlite, pgSchema.failureHistory);
export const predictionFeedback = pickSchema(isLocalMode, sqliteVessel.predictionFeedbackSqlite, pgSchema.predictionFeedback);
export const modelPerformanceValidations = pickSchema(isLocalMode, sqliteVessel.modelPerformanceValidationsSqlite, pgSchema.modelPerformanceValidations);
export const retrainingTriggers = pickSchema(isLocalMode, sqliteVessel.retrainingTriggersSqlite, pgSchema.retrainingTriggers);
export const thresholdOptimizations = pickSchema(isLocalMode, sqliteVessel.thresholdOptimizationsSqlite, pgSchema.thresholdOptimizations);
export const modelRegistry = pickSchema(isLocalMode, sqliteVessel.modelRegistrySqlite, pgSchema.modelRegistry);
export const rulModels = cloudOnly(pgSchema.rulModels);
export const rulFitHistory = cloudOnly(pgSchema.rulFitHistory);
export const weibullEstimates = cloudOnly(pgSchema.weibullEstimates);

// Insights & Analytics
export const insightSnapshots = pickSchema(isLocalMode, sqliteVessel.insightSnapshotsSqlite, pgSchema.insightSnapshots);
export const insightReports = pickSchema(isLocalMode, sqliteVessel.insightReportsSqlite, pgSchema.insightReports);
export const metricsHistory = cloudOnly(pgSchema.metricsHistory);
export const dailyMetricRollups = cloudOnly(pgSchema.dailyMetricRollups);
export const dataQualityMetrics = cloudOnly(pgSchema.dataQualityMetrics);
export const telemetryAggregates = pickSchema(isLocalMode, sqliteVessel.telemetryAggregatesSqlite, pgSchema.telemetryAggregates);
export const telemetryRollups = pickSchema(isLocalMode, sqliteVessel.telemetryRollupsSqlite, pgSchema.telemetryRollups);
export const industryBenchmarks = cloudOnly(pgSchema.industryBenchmarks);

// DTC & Diagnostics
export const dtcDefinitions = pickSchema(isLocalMode, sqliteVessel.dtcDefinitionsSqlite, pgSchema.dtcDefinitions);
export const dtcFaults = pickSchema(isLocalMode, sqliteVessel.dtcFaultsSqlite, pgSchema.dtcFaults);

// System & Configuration
export const systemSettings = cloudOnly(pgSchema.systemSettings);
export const systemPerformanceMetrics = cloudOnly(pgSchema.systemPerformanceMetrics);
export const systemHealthChecks = cloudOnly(pgSchema.systemHealthChecks);
export const transportSettings = cloudOnly(pgSchema.transportSettings);
export const transportFailovers = cloudOnly(pgSchema.transportFailovers);
export const integrationConfigs = pickSchema(isLocalMode, sqliteVessel.integrationConfigsSqlite, pgSchema.integrationConfigs);
export const storageConfig = pickSchema(isLocalMode, sqliteVessel.storageConfigSqlite, pgSchema.storageConfig);

// Edge & IoT
export const edgeHeartbeats = pickSchema(isLocalMode, sqliteVessel.edgeHeartbeatsSqlite, pgSchema.edgeHeartbeats);
export const edgeDiagnosticLogs = cloudOnly(pgSchema.edgeDiagnosticLogs);
export const mqttDevices = cloudOnly(pgSchema.mqttDevices);
export const serialPortStates = cloudOnly(pgSchema.serialPortStates);
export const j1939Configurations = pickSchema(isLocalMode, sqliteVessel.j1939ConfigurationsSqlite, pgSchema.j1939Configurations);
export const calibrationCache = pickSchema(isLocalMode, sqliteVessel.calibrationCacheSqlite, pgSchema.calibrationCache);

// Condition Monitoring
export const conditionMonitoring = cloudOnly(pgSchema.conditionMonitoring);
export const oilAnalysis = cloudOnly(pgSchema.oilAnalysis);
export const wearParticleAnalysis = cloudOnly(pgSchema.wearParticleAnalysis);
export const oilChangeRecords = cloudOnly(pgSchema.oilChangeRecords);
export const vibrationFeatures = pickSchema(isLocalMode, sqliteVessel.vibrationFeaturesSqlite, pgSchema.vibrationFeatures);
export const vibrationAnalysis = cloudOnly(pgSchema.vibrationAnalysis);
export const operatingParameters = pickSchema(isLocalMode, sqliteVessel.operatingParametersSqlite, pgSchema.operatingParameters);

// Scheduling & Optimization
export const scheduleOptimizations = pickSchema(isLocalMode, sqliteVessel.scheduleOptimizationsSqlite, pgSchema.scheduleOptimizations);
export const optimizerConfigurations = pickSchema(isLocalMode, sqliteVessel.optimizerConfigurationsSqlite, pgSchema.optimizerConfigurations);
export const resourceConstraints = pickSchema(isLocalMode, sqliteVessel.resourceConstraintsSqlite, pgSchema.resourceConstraints);
export const optimizationResults = pickSchema(isLocalMode, sqliteVessel.optimizationResultsSqlite, pgSchema.optimizationResults);

// Compliance & Costs
export const complianceBundles = pickSchema(isLocalMode, sqliteVessel.complianceBundlesSqlite, pgSchema.complianceBundles);
export const complianceDocs = pickSchema(isLocalMode, sqliteVessel.complianceDocsSqlite, pgSchema.complianceDocs);
export const complianceAuditLog = pickSchema(isLocalMode, sqliteVessel.complianceAuditLogSqlite, pgSchema.complianceAuditLog);
export const costSavings = pickSchema(isLocalMode, sqliteVessel.costSavingsSqlite, pgSchema.costSavings);
export const costModel = cloudOnly(pgSchema.costModel);
export const laborRates = pickSchema(isLocalMode, sqliteVessel.laborRatesSqlite, pgSchema.laborRates);
export const expenses = pickSchema(isLocalMode, sqliteVessel.expensesSqlite, pgSchema.expenses);

// Vessel Operations
export const portCall = pickSchema(isLocalMode, sqliteVessel.portCallSqlite, pgSchema.portCall);
export const drydockWindow = pickSchema(isLocalMode, sqliteVessel.drydockWindowSqlite, pgSchema.drydockWindow);

// Digital Twin & Simulation
export const digitalTwins = cloudOnly(pgSchema.digitalTwins);
export const twinSimulations = cloudOnly(pgSchema.twinSimulations);
export const visualizationAssets = pickSchema(isLocalMode, sqliteVessel.visualizationAssetsSqlite, pgSchema.visualizationAssets);

// Admin & Security
export const adminAuditEvents = pickSchema(isLocalMode, sqliteVessel.adminAuditEventsSqlite, pgSchema.adminAuditEvents);
export const adminSystemSettings = pickSchema(isLocalMode, sqliteVessel.adminSystemSettingsSqlite, pgSchema.adminSystemSettings);

// Compliance & Security Infrastructure (Phase 1 Compliance Hardening)
export const immutableAuditTrail = pickSchema(isLocalMode, sqliteVessel.immutableAuditTrailSqlite, pgSchema.immutableAuditTrail);
export const engineerOverrides = pickSchema(isLocalMode, sqliteVessel.engineerOverridesSqlite, pgSchema.engineerOverrides);
export const predictionDataQuality = pickSchema(isLocalMode, sqliteVessel.predictionDataQualitySqlite, pgSchema.predictionDataQuality);
export const userSessions = pickSchema(isLocalMode, sqliteVessel.userSessionsSqlite, pgSchema.userSessions);
export const loginEvents = pickSchema(isLocalMode, sqliteVessel.loginEventsSqlite, pgSchema.loginEvents);
export const dataSubjectRequests = pickSchema(isLocalMode, sqliteVessel.dataSubjectRequestsSqlite, pgSchema.dataSubjectRequests);
export const crossBorderTransfers = pickSchema(isLocalMode, sqliteVessel.crossBorderTransfersSqlite, pgSchema.crossBorderTransfers);
export const syncProtocolVersion = pickSchema(isLocalMode, sqliteVessel.syncProtocolVersionSqlite, pgSchema.syncProtocolVersion);

// Error Handling & Logging
export const errorLogs = pickSchema(isLocalMode, sqliteVessel.errorLogsSqlite, pgSchema.errorLogs);
export const idempotencyLog = pickSchema(isLocalMode, sqliteVessel.idempotencyLogSqlite, pgSchema.idempotencyLog);
export const requestIdempotency = pickSchema(isLocalMode, sqliteVessel.requestIdempotencySqlite, pgSchema.requestIdempotency);

// AR & Advanced Features
export const arMaintenanceProcedures = pickSchema(isLocalMode, sqliteVessel.arMaintenanceProceduresSqlite, pgSchema.arMaintenanceProcedures);
export const beastModeConfig = cloudOnly(pgSchema.beastModeConfig);

// Telemetry & Data Management
export const telemetryRetentionPolicies = cloudOnly(pgSchema.telemetryRetentionPolicies);
export const opsDbStaged = pickSchema(isLocalMode, sqliteVessel.opsDbStagedSqlite, pgSchema.opsDbStaged);
export const replayIncoming = cloudOnly(pgSchema.replayIncoming);
export const sheetLock = pickSchema(isLocalMode, sqliteVessel.sheetLockSqlite, pgSchema.sheetLock);
export const sheetVersion = pickSchema(isLocalMode, sqliteVessel.sheetVersionSqlite, pgSchema.sheetVersion);
export const dbSchemaVersion = pickSchema(isLocalMode, sqliteVessel.dbSchemaVersionSqlite, pgSchema.dbSchemaVersion);

// LLM & AI Features
export const llmBudgetConfigs = pickSchema(isLocalMode, sqliteVessel.llmBudgetConfigsSqlite, pgSchema.llmBudgetConfigs);
export const llmCostTracking = pickSchema(isLocalMode, sqliteVessel.llmCostTrackingSqlite, pgSchema.llmCostTracking);
export const ragSearchQueries = pickSchema(isLocalMode, sqliteVessel.ragSearchQueriesSqlite, pgSchema.ragSearchQueries);
export const contentSources = pickSchema(isLocalMode, sqliteVessel.contentSourcesSqlite, pgSchema.contentSources);
export const knowledgeBaseItems = pickSchema(isLocalMode, sqliteVessel.knowledgeBaseItemsSqlite, pgSchema.kbDocs);

// Sync & Conflicts
export const syncConflicts = pickSchema(isLocalMode, sqliteVessel.syncConflictsSqlite, pgSchema.syncConflicts);

// ============================================================================
// POSTGRESQL-ONLY TABLES (guarded exports - undefined in SQLite mode)
// These tables only exist in cloud deployments and will crash if accessed in SQLite mode
// ============================================================================
export const softwarePatches = cloudOnly(pgSchema.softwarePatches);
export const configAuditLog = cloudOnly(pgSchema.configAuditLog);
const _sqliteUpdateSettings = (sqliteVessel as Record<string, unknown>).updateSettingsSqlite as typeof pgSchema.updateSettings | undefined;
export const updateSettings = (IS_POSTGRES ? pgSchema.updateSettings : _sqliteUpdateSettings) as typeof pgSchema.updateSettings;
export const patchDownloads = cloudOnly(pgSchema.patchDownloads);
export const adminSessions = cloudOnly(pgSchema.adminSessions);
export const modelDeployments = cloudOnly(pgSchema.modelDeployments);
export const entityOffsets = cloudOnly(pgSchema.entityOffsets);
export const contextEvents = cloudOnly(pgSchema.contextEvents);
export const auditRuns = cloudOnly(pgSchema.auditRuns);
export const auditWebhookSubscriptions = cloudOnly(pgSchema.auditWebhookSubscriptions);
export const kbDocs = cloudOnly(pgSchema.kbDocs); // Note: knowledgeBaseItems is the SQLite equivalent
export const kbDocVersions = cloudOnly(pgSchema.kbDocVersions);
export const kbChunks = cloudOnly(pgSchema.kbChunks);
export const kbEmbeddingCache = cloudOnly(pgSchema.kbEmbeddingCache);

// RAG Conversation System (PostgreSQL-only)
export const ragConversations = cloudOnly(pgSchema.ragConversations);
export const ragMessages = cloudOnly(pgSchema.ragMessages);
export const ragFeedback = cloudOnly(pgSchema.ragFeedback);
export const ragSemanticCache = cloudOnly(pgSchema.ragSemanticCache);
export const weatherCache = cloudOnly(pgSchema.weatherCache);
export const schedulerRuns = (IS_POSTGRES ? pgSchema.schedulerRuns : sqliteVessel.schedulerRunsSqlite) as typeof pgSchema.schedulerRuns;
export const scheduleAssignments = (IS_POSTGRES ? pgSchema.scheduleAssignments : sqliteVessel.scheduleAssignmentsSqlite) as typeof pgSchema.scheduleAssignments;
export const scheduleUnfilled = (IS_POSTGRES ? pgSchema.scheduleUnfilled : sqliteVessel.scheduleUnfilledSqlite) as typeof pgSchema.scheduleUnfilled;
export const mlModelsLegacy = cloudOnly(pgSchema.mlModelsLegacy);
export const calibrationCurves = cloudOnly(pgSchema.calibrationCurves);
export const realTimePredictions = cloudOnly(pgSchema.realTimePredictions);
export const featureImportances = cloudOnly(pgSchema.featureImportances);
export const sensorFusionSnapshots = cloudOnly(pgSchema.sensorFusionSnapshots);
export const acousticEvents = cloudOnly(pgSchema.acousticEvents);

// Digital Deck Logbook
export const deckLogDaily = cloudOnly(pgSchema.deckLogDaily);
export const deckLogHourly = cloudOnly(pgSchema.deckLogHourly);
export const deckLogWatch = cloudOnly(pgSchema.deckLogWatch);
export const deckLogEvents = cloudOnly(pgSchema.deckLogEvents);

// Digital Engine Room Logbook
export const engineLogDaily = cloudOnly(pgSchema.engineLogDaily);
export const engineLogHourly = cloudOnly(pgSchema.engineLogHourly);
export const engineLogGenerator = cloudOnly(pgSchema.engineLogGenerator);
export const engineLogWatch = cloudOnly(pgSchema.engineLogWatch);
export const engineLogEvents = cloudOnly(pgSchema.engineLogEvents);

// Compliance Rules Engine
export const complianceFindings = cloudOnly(pgSchema.complianceFindings);
export const complianceRules = cloudOnly(pgSchema.complianceRules);

// Notification System
export const notificationSettings = cloudOnly(pgSchema.notificationSettings);
export const notificationQueue = cloudOnly(pgSchema.notificationQueue);

// StormGeo Integration
export const stormgeoSettings = cloudOnly(pgSchema.stormgeoSettings);
export const stormgeoSnapshots = cloudOnly(pgSchema.stormgeoSnapshots);
export const deckLogHourlyAutoFill = cloudOnly(pgSchema.deckLogHourlyAutoFill);
export const stormgeoImportHistory = cloudOnly(pgSchema.stormgeoImportHistory);

// External Data Cache (AI Copilot - cloud-only)
export const externalDataCache = cloudOnly(pgSchema.externalDataCache);

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
