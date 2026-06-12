/**
 * Operational mode-aware table exports for schema-runtime.
 */

import {
  cloudOnly,
  isLocalMode,
  pgSchema,
  pickSchema,
  sqliteVessel,
} from "./schema-runtime-table-helpers";

// Insights & Analytics
export const insightSnapshots = pickSchema(
  isLocalMode,
  sqliteVessel.insightSnapshotsSqlite,
  pgSchema.insightSnapshots
);
export const insightReports = pickSchema(
  isLocalMode,
  sqliteVessel.insightReportsSqlite,
  pgSchema.insightReports
);
export const metricsHistory = cloudOnly(pgSchema.metricsHistory);
export const dailyMetricRollups = cloudOnly(pgSchema.dailyMetricRollups);
export const dataQualityMetrics = cloudOnly(pgSchema.dataQualityMetrics);
export const industryBenchmarks = cloudOnly(pgSchema.industryBenchmarks);

// DTC & Diagnostics
export const dtcDefinitions = pickSchema(
  isLocalMode,
  sqliteVessel.dtcDefinitionsSqlite,
  pgSchema.dtcDefinitions
);
export const dtcFaults = pickSchema(isLocalMode, sqliteVessel.dtcFaultsSqlite, pgSchema.dtcFaults);

// System & Configuration
export const systemSettings = cloudOnly(pgSchema.systemSettings);
export const systemPerformanceMetrics = cloudOnly(pgSchema.systemPerformanceMetrics);
export const systemHealthChecks = cloudOnly(pgSchema.systemHealthChecks);
export const transportSettings = cloudOnly(pgSchema.transportSettings);
export const transportFailovers = cloudOnly(pgSchema.transportFailovers);
export const integrationConfigs = pickSchema(
  isLocalMode,
  sqliteVessel.integrationConfigsSqlite,
  pgSchema.integrationConfigs
);
export const storageConfig = pickSchema(
  isLocalMode,
  sqliteVessel.storageConfigSqlite,
  pgSchema.storageConfig
);

// Edge & IoT
export const edgeHeartbeats = pickSchema(
  isLocalMode,
  sqliteVessel.edgeHeartbeatsSqlite,
  pgSchema.edgeHeartbeats
);
export const edgeDiagnosticLogs = cloudOnly(pgSchema.edgeDiagnosticLogs);
export const mqttDevices = cloudOnly(pgSchema.mqttDevices);
export const serialPortStates = cloudOnly(pgSchema.serialPortStates);
export const j1939Configurations = pickSchema(
  isLocalMode,
  sqliteVessel.j1939ConfigurationsSqlite,
  pgSchema.j1939Configurations
);
export const calibrationCache = pickSchema(
  isLocalMode,
  sqliteVessel.calibrationCacheSqlite,
  pgSchema.calibrationCache
);

// Condition Monitoring
export const conditionMonitoring = cloudOnly(pgSchema.conditionMonitoring);
export const oilAnalysis = cloudOnly(pgSchema.oilAnalysis);
export const wearParticleAnalysis = cloudOnly(pgSchema.wearParticleAnalysis);
export const oilChangeRecords = cloudOnly(pgSchema.oilChangeRecords);
export const vibrationFeatures = pickSchema(
  isLocalMode,
  sqliteVessel.vibrationFeaturesSqlite,
  pgSchema.vibrationFeatures
);
export const vibrationAnalysis = cloudOnly(pgSchema.vibrationAnalysis);
export const operatingParameters = pickSchema(
  isLocalMode,
  sqliteVessel.operatingParametersSqlite,
  pgSchema.operatingParameters
);

// Scheduling & Optimization
export const scheduleOptimizations = pickSchema(
  isLocalMode,
  sqliteVessel.scheduleOptimizationsSqlite,
  pgSchema.scheduleOptimizations
);
export const optimizerConfigurations = pickSchema(
  isLocalMode,
  sqliteVessel.optimizerConfigurationsSqlite,
  pgSchema.optimizerConfigurations
);
export const resourceConstraints = pickSchema(
  isLocalMode,
  sqliteVessel.resourceConstraintsSqlite,
  pgSchema.resourceConstraints
);
export const optimizationResults = pickSchema(
  isLocalMode,
  sqliteVessel.optimizationResultsSqlite,
  pgSchema.optimizationResults
);

// Compliance & Costs
export const complianceBundles = pickSchema(
  isLocalMode,
  sqliteVessel.complianceBundlesSqlite,
  pgSchema.complianceBundles
);
export const complianceDocs = pickSchema(
  isLocalMode,
  sqliteVessel.complianceDocsSqlite,
  pgSchema.complianceDocs
);
export const complianceAuditLog = pickSchema(
  isLocalMode,
  sqliteVessel.complianceAuditLogSqlite,
  pgSchema.complianceAuditLog
);
export const costSavings = pickSchema(
  isLocalMode,
  sqliteVessel.costSavingsSqlite,
  pgSchema.costSavings
);
export const costModel = cloudOnly(pgSchema.costModel);
export const laborRates = pickSchema(
  isLocalMode,
  sqliteVessel.laborRatesSqlite,
  pgSchema.laborRates
);
export const expenses = pickSchema(isLocalMode, sqliteVessel.expensesSqlite, pgSchema.expenses);

// Vessel Operations
export const portCall = pickSchema(isLocalMode, sqliteVessel.portCallSqlite, pgSchema.portCall);
export const drydockWindow = pickSchema(
  isLocalMode,
  sqliteVessel.drydockWindowSqlite,
  pgSchema.drydockWindow
);

// Digital Twin & Simulation
export const digitalTwins = cloudOnly(pgSchema.digitalTwins);
export const twinSimulations = cloudOnly(pgSchema.twinSimulations);
export const visualizationAssets = pickSchema(
  isLocalMode,
  sqliteVessel.visualizationAssetsSqlite,
  pgSchema.visualizationAssets
);
export const vessel3dModels = cloudOnly(pgSchema.vessel3dModels);
export const equipmentDependencies = cloudOnly(pgSchema.equipmentDependencies);
export const equipmentDependencyLayouts = cloudOnly(pgSchema.equipmentDependencyLayouts);

// Admin & Security
export const adminAuditEvents = pickSchema(
  isLocalMode,
  sqliteVessel.adminAuditEventsSqlite,
  pgSchema.adminAuditEvents
);
export const adminSystemSettings = pickSchema(
  isLocalMode,
  sqliteVessel.adminSystemSettingsSqlite,
  pgSchema.adminSystemSettings
);
export const roleDashboardConfigs = cloudOnly(pgSchema.roleDashboardConfigs);
export const userVesselAssignments = cloudOnly(pgSchema.userVesselAssignments);
export const userDashboardPreferences = cloudOnly(pgSchema.userDashboardPreferences);

// Compliance & Security Infrastructure (Phase 1 Compliance Hardening)
export const immutableAuditTrail = pickSchema(
  isLocalMode,
  sqliteVessel.immutableAuditTrailSqlite,
  pgSchema.immutableAuditTrail
);
export const engineerOverrides = pickSchema(
  isLocalMode,
  sqliteVessel.engineerOverridesSqlite,
  pgSchema.engineerOverrides
);
export const predictionDataQuality = pickSchema(
  isLocalMode,
  sqliteVessel.predictionDataQualitySqlite,
  pgSchema.predictionDataQuality
);
export const userSessions = pickSchema(
  isLocalMode,
  sqliteVessel.userSessionsSqlite,
  pgSchema.userSessions
);
export const loginEvents = pickSchema(
  isLocalMode,
  sqliteVessel.loginEventsSqlite,
  pgSchema.loginEvents
);
export const dataSubjectRequests = pickSchema(
  isLocalMode,
  sqliteVessel.dataSubjectRequestsSqlite,
  pgSchema.dataSubjectRequests
);
export const crossBorderTransfers = pickSchema(
  isLocalMode,
  sqliteVessel.crossBorderTransfersSqlite,
  pgSchema.crossBorderTransfers
);
export const syncProtocolVersion = pickSchema(
  isLocalMode,
  sqliteVessel.syncProtocolVersionSqlite,
  pgSchema.syncProtocolVersion
);

// Error Handling & Logging
export const errorLogs = pickSchema(isLocalMode, sqliteVessel.errorLogsSqlite, pgSchema.errorLogs);
export const idempotencyLog = pickSchema(
  isLocalMode,
  sqliteVessel.idempotencyLogSqlite,
  pgSchema.idempotencyLog
);
export const requestIdempotency = pickSchema(
  isLocalMode,
  sqliteVessel.requestIdempotencySqlite,
  pgSchema.requestIdempotency
);
export const eventOutbox = cloudOnly(pgSchema.eventOutbox);

// AR & Advanced Features
export const arMaintenanceProcedures = pickSchema(
  isLocalMode,
  sqliteVessel.arMaintenanceProceduresSqlite,
  pgSchema.arMaintenanceProcedures
);
export const beastModeConfig = cloudOnly(pgSchema.beastModeConfig);

// Telemetry & Data Management
export const telemetryRetentionPolicies = cloudOnly(pgSchema.telemetryRetentionPolicies);
export const opsDbStaged = pickSchema(
  isLocalMode,
  sqliteVessel.opsDbStagedSqlite,
  pgSchema.opsDbStaged
);
export const replayIncoming = cloudOnly(pgSchema.replayIncoming);
export const sheetLock = pickSchema(isLocalMode, sqliteVessel.sheetLockSqlite, pgSchema.sheetLock);
export const sheetVersion = pickSchema(
  isLocalMode,
  sqliteVessel.sheetVersionSqlite,
  pgSchema.sheetVersion
);
export const dbSchemaVersion = pickSchema(
  isLocalMode,
  sqliteVessel.dbSchemaVersionSqlite,
  pgSchema.dbSchemaVersion
);

// LLM & AI Features
export const llmBudgetConfigs = pickSchema(
  isLocalMode,
  sqliteVessel.llmBudgetConfigsSqlite,
  pgSchema.llmBudgetConfigs
);
export const llmCostTracking = pickSchema(
  isLocalMode,
  sqliteVessel.llmCostTrackingSqlite,
  pgSchema.llmCostTracking
);
export const ragSearchQueries = pickSchema(
  isLocalMode,
  sqliteVessel.ragSearchQueriesSqlite,
  pgSchema.ragSearchQueries
);
export const contentSources = pickSchema(
  isLocalMode,
  sqliteVessel.contentSourcesSqlite,
  pgSchema.contentSources
);
export const knowledgeBaseItems = pickSchema(
  isLocalMode,
  sqliteVessel.knowledgeBaseItemsSqlite,
  pgSchema.kbDocs
);

// Sync & Conflicts
export const syncConflicts = pickSchema(
  isLocalMode,
  sqliteVessel.syncConflictsSqlite,
  pgSchema.syncConflicts
);
