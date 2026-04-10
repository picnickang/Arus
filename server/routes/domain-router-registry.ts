/**
 * Domain Router Registry - Centralized domain router registration
 * Extracted from routes.ts for modularization
 * 
 * This file defines all domain routers and their dependencies in a declarative way,
 * dramatically reducing the main routes.ts file size.
 */

import type { Express } from "express";
import {
  generalApiRateLimit,
  writeOperationRateLimit,
  criticalOperationRateLimit,
  crewOperationRateLimit,
  reportGenerationRateLimit,
  telemetryRateLimit,
  requireOrgId,
  requireValidOrgId,
  validateHMAC,
  requireAdminAuth,
  auditAdminAction,
  getSyncMetrics,
  processPendingEvents,
  recordAndPublish,
  schedulerEventBus,
  adaptiveTrainingWindow,
  getWebSocketServer,
  getFMCCService,
  updateFleetHealthScore,
  checkMonthCompliance,
  normalizeRestDays,
  generatePdfFilename,
  renderRestPdf,
  incrementIdempotencyHit,
  incrementHorImport,
  incrementHorPdfExport,
  incrementRangeQuery,
  recordRangeQueryDuration,
  getDatabaseHealth,
  enableTimescaleDB,
  createHypertable,
  createContinuousAggregate,
  enableCompression,
  getRetentionPolicy,
  updateRetentionPolicy,
  applyTelemetryRetention,
  getDatabasePerformanceHealth,
  getIndexOptimizationSuggestions,
  getBackupStatus,
  listBackups,
  createFullBackup,
  createSchemaBackup,
  cleanupOldBackups,
  verifyBackupIntegrity,
  mqttIngestionService,
  mlAnalyticsService,
  digitalTwinService,
  db,
  upload,
  adminPasswordVerifySchema,
  adminPasswordChangeSchema,
  insertAdminAuditEventSchema,
  insertAdminSystemSettingSchema,
  insertIntegrationConfigSchema,
  insertMaintenanceWindowSchema,
  insertSystemPerformanceMetricSchema,
  configAuditLog,
} from "./route-dependencies";

/**
 * CANONICAL PATTERN — Every domain uses one registration signature:
 *
 *   registerMyRoutes(app: Express, deps: { ... }): void
 *
 * To add a new domain, add an entry to the domainRouters array:
 *
 *   { name: "MyDomain", importPath: "../domains/my-domain/index.js",
 *     functionName: "registerMyRoutes",
 *     getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },
 *
 * For legacy Express Router objects, use a wrapper from legacy-router-wrappers.ts:
 *   { name: "MyLegacy", importPath: "../routes/legacy-router-wrappers.js",
 *     functionName: "registerMyLegacyRoutes",
 *     getDeps: () => ({ generalApiRateLimit }) },
 */

interface DomainRouterConfig {
  name: string;
  importPath: string;
  functionName: string;
  getDeps: () => Record<string, any>;
}

const domainRouters: DomainRouterConfig[] = [
  // Core domain routers (basic CRUD)
  { name: "WorkOrder", importPath: "../domains/work-orders/index.js", functionName: "registerWorkOrderRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Equipment", importPath: "../domains/equipment/index.js", functionName: "registerEquipmentRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "FleetRegistry", importPath: "../modules/fleet-registry/index.js", functionName: "registerFleetRegistryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Devices", importPath: "../domains/devices/index.js", functionName: "registerDeviceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Maintenance", importPath: "../domains/maintenance/index.js", functionName: "registerMaintenanceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Inventory", importPath: "../domains/inventory/index.js", functionName: "registerInventoryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Crew", importPath: "../domains/crew/index.js", functionName: "registerCrewRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Alerts (special - needs websocket)
  { name: "Alerts", importPath: "../domains/alerts/index.js", functionName: "registerAlertsRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit, wsServer: getWebSocketServer() }) },
  { name: "AlertSettings", importPath: "../domains/alerts/index.js", functionName: "registerAlertSettingsRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Logbook & Telemetry
  { name: "Logbook", importPath: "../domains/logbook/index.js", functionName: "registerLogbookRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Telemetry", importPath: "../domains/telemetry/index.js", functionName: "registerTelemetryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit, telemetryRateLimit }) },
  { name: "TelemetryIngestion", importPath: "../domains/telemetry/ingestion-routes.js", functionName: "registerTelemetryIngestionRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit, telemetryRateLimit, requireValidOrgId, validateHMAC }) },
  { name: "TelemetryHealth", importPath: "../domains/telemetry/lib/health-controller.js", functionName: "registerTelemetryHealthRoutes",
    getDeps: () => ({}) },

  // Compliance & Notifications
  { name: "Compliance", importPath: "../domains/compliance/index.js", functionName: "registerComplianceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Notifications", importPath: "../domains/notifications/index.js", functionName: "registerNotificationRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Integrations
  { name: "Integrations", importPath: "../domains/integrations/index.js", functionName: "registerIntegrationsRoutes",
    getDeps: () => ({ generalApiRateLimit, getFMCCService, updateFleetHealthScore }) },
  { name: "DTC", importPath: "../domains/dtc/index.js", functionName: "registerDtcRoutes",
    getDeps: () => ({ writeOperationRateLimit, getWebSocketServer }) },

  // ML & Analytics
  { name: "MLAnalytics", importPath: "../domains/ml-analytics/index.js", functionName: "registerMlAnalyticsRoutes",
    getDeps: () => ({ writeOperationRateLimit, schedulerEventBus, adaptiveTrainingWindow }) },
  { name: "CostSavings", importPath: "../domains/cost-savings/index.js", functionName: "registerCostSavingsRoutes",
    getDeps: () => ({ writeOperationRateLimit }) },
  { name: "ConditionMonitoring", importPath: "../domains/condition-monitoring/index.js", functionName: "registerConditionMonitoringRoutes",
    getDeps: () => ({ generalApiRateLimit }) },

  // Sync
  { name: "Sync", importPath: "../domains/sync/index.js", functionName: "registerSyncRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit, getSyncMetrics, processPendingEvents, recordAndPublish }) },
  // NOTE: CrewExtensions MUST be registered BEFORE Scheduling to ensure
  // /api/schedule/runs is matched before the generic /api/schedule/:id
  { name: "CrewExtensions", importPath: "../domains/crew-extensions/index.js", functionName: "registerCrewExtensionsRoutes",
    getDeps: () => ({ crewOperationRateLimit, criticalOperationRateLimit }) },
  { name: "Scheduling", importPath: "../domains/scheduling/index.js", functionName: "registerSchedulingRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },

  // Weather & External
  { name: "StormGeo", importPath: "../domains/stormgeo/index.js", functionName: "registerStormGeoRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },
  { name: "Vibration", importPath: "../domains/vibration/index.js", functionName: "registerVibrationRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  // Sensor Management
  { name: "SensorManagement", importPath: "../domains/sensor-management/index.js", functionName: "registerSensorManagementRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit }) },

  // Hub Sync & Insights
  { name: "HubSync", importPath: "../domains/hub-sync/index.js", functionName: "registerHubSyncRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }) },
  { name: "InsightsV2", importPath: "../domains/insights/index.js", functionName: "registerInsightsV2Routes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, reportGenerationRateLimit }) },

  // LLM & ML Pipeline
  { name: "LLM", importPath: "../domains/llm/index.js", functionName: "registerLlmRoutes",
    getDeps: () => ({ generalApiRateLimit, reportGenerationRateLimit }) },
  { name: "MLPipeline", importPath: "../domains/ml-pipeline/index.js", functionName: "registerMlPipelineRoutes",
    getDeps: () => ({ generalApiRateLimit }) },

  // Crew Extensions registered earlier (before Scheduling) for route priority
  // Vessel Performance
  { name: "VesselPerformance", importPath: "../domains/vessel-performance/index.js", functionName: "registerVesselPerformanceRoutes",
    getDeps: () => ({ crewOperationRateLimit }) },

  // STCW Rest
  { name: "STCWRest", importPath: "../domains/stcw-rest/index.js", functionName: "registerStcwRestRoutes",
    getDeps: () => ({ writeOperationRateLimit, checkMonthCompliance, normalizeRestDays, generatePdfFilename, renderRestPdf,
      incrementIdempotencyHit, incrementHorImport, incrementHorPdfExport, incrementRangeQuery, recordRangeQueryDuration }) },

  // IoT Processing
  { name: "IoTProcessing", importPath: "../domains/iot-processing/index.js", functionName: "registerIotProcessingRoutes",
    getDeps: () => ({ writeOperationRateLimit, mqttIngestionService, mlAnalyticsService, digitalTwinService }) },

  // System Admin
  { name: "SystemAdmin", importPath: "../domains/system-admin/index.js", functionName: "registerSystemAdminRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction,
      adminPasswordVerifySchema, adminPasswordChangeSchema, insertAdminAuditEventSchema, insertAdminSystemSettingSchema,
      insertIntegrationConfigSchema, insertMaintenanceWindowSchema, insertSystemPerformanceMetricSchema }) },

  // Config Management
  { name: "ConfigManagement", importPath: "../domains/config-management/index.js", functionName: "registerConfigManagementRoutes",
    getDeps: () => ({ db, configAuditLog, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction }) },

  // Software Updates
  { name: "SoftwareUpdates", importPath: "../domains/software-updates/index.js", functionName: "registerSoftwareUpdatesRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction }) },

  // Data Export
  { name: "DataExport", importPath: "../domains/data-export/index.js", functionName: "registerDataExportRoutes",
    getDeps: () => ({ generalApiRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction, upload }) },

  // Inventory Optimization
  { name: "InventoryOptimization", importPath: "../domains/inventory-optimization/index.js", functionName: "registerInventoryOptimizationRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },

  // Storage Config
  { name: "StorageConfig", importPath: "../domains/storage-config/index.js", functionName: "registerStorageConfigRoutes",
    getDeps: () => ({}) },

  // Autofill Logs
  { name: "AutofillLogs", importPath: "../domains/autofill-logs/index.js", functionName: "registerAutofillLogsRoutes",
    getDeps: () => ({ writeOperationRateLimit }) },

  // Health Monitoring
  { name: "HealthMonitoring", importPath: "../domains/health-monitoring/index.js", functionName: "registerHealthMonitoringRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },

  // Settings
  { name: "Settings", importPath: "../domains/settings/index.js", functionName: "registerSettingsRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },

  // Permissions
  { name: "Permissions", importPath: "../domains/permissions/routes.js", functionName: "registerPermissionRoutes",
    getDeps: () => ({}) },

  // Class Survey Tracking
  { name: "Surveys", importPath: "../domains/surveys/routes.js", functionName: "registerSurveyRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },

  // Home Attention Summary
  { name: "Home", importPath: "../routes/home-routes.js", functionName: "registerHomeRoutes",
    getDeps: () => ({ generalApiRateLimit, requireOrgId }) },

  // KB Ask (unified search + analyze)
  { name: "KbAsk", importPath: "../routes/kb-ask-route.js", functionName: "registerKbAskRoute",
    getDeps: () => ({ generalApiRateLimit }) },

  // AI Copilot Agent
  { name: "Agent", importPath: "../domains/agent/index.js", functionName: "registerAgentRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },

  // Purchasing Pipeline (read-only pipeline view)
  { name: "PurchasingPipeline", importPath: "../domains/purchasing/index.js", functionName: "registerPurchasingPipelineRoutes",
    getDeps: () => ({ generalApiRateLimit }) },

  // Certificate Registry (hexagonal)
  { name: "Certificates", importPath: "../domains/certificates/index.js", functionName: "registerCertificateRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },

  // Schematic Layout (hexagonal - vessel cross-section zone/slot config)
  { name: "SchematicLayout", importPath: "../domains/schematic-layout/index.js", functionName: "registerSchematicLayoutRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },

  // Logbook Corrections (correction workflow + immutable audit trail)
  { name: "LogbookCorrections", importPath: "../domains/logbook/index.js", functionName: "registerLogbookCorrectionRoutes",
    getDeps: () => ({}) },

  // Sensor Calibration Registry (PdM data quality)
  { name: "SensorCalibration", importPath: "../domains/sensors/index.js", functionName: "registerSensorCalibrationRoutes",
    getDeps: () => ({}) },

  // OSV-Specific Domains
  { name: "DpMonitoring", importPath: "../domains/dp/index.js", functionName: "registerDpRoutes",
    getDeps: () => ({}) },
  { name: "CharterCompliance", importPath: "../domains/charter/index.js", functionName: "registerCharterRoutes",
    getDeps: () => ({}) },
  { name: "Vetting", importPath: "../domains/vetting/index.js", functionName: "registerVettingRoutes",
    getDeps: () => ({}) },
  { name: "OffshoreOps", importPath: "../domains/offshore-ops/index.js", functionName: "registerOffshoreOpsRoutes",
    getDeps: () => ({}) },
  { name: "Efms", importPath: "../domains/efms/index.js", functionName: "registerEfmsRoutes",
    getDeps: () => ({}) },
  { name: "Rms", importPath: "../domains/rms/index.js", functionName: "registerRmsRoutes",
    getDeps: () => ({}) },

  // ===== Previously legacy function-style routes (migrated from routes.ts) =====

  { name: "KnowledgeBase", importPath: "../routes/kb-routes.js", functionName: "registerKnowledgeBaseRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },
  { name: "Rag", importPath: "../routes/rag-routes.js", functionName: "registerRagRoutes",
    getDeps: () => ({ generalApiRateLimit, reportGenerationRateLimit }) },
  { name: "RagSecurity", importPath: "../routes/rag-security-routes.js", functionName: "registerRagSecurityRoutes",
    getDeps: () => ({}) },
  { name: "InsightsLegacy", importPath: "../routes/insights-routes.js", functionName: "registerInsightsRoutes",
    getDeps: () => ({}) },
  { name: "EquipmentContext", importPath: "../routes/equipment-context-routes.js", functionName: "registerEquipmentContextRoutes",
    getDeps: () => ({}) },
  { name: "Analytics", importPath: "../routes/analytics.js", functionName: "mountAnalyticsRoutes",
    getDeps: () => ({}) },
  { name: "WoSoBridge", importPath: "../routes/wo-so-bridge-routes.js", functionName: "registerWoSoBridgeRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }) },
  { name: "ServiceRequests", importPath: "../routes/service-request-routes.js", functionName: "registerServiceRequestRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }) },
  { name: "PdmGapFill", importPath: "../routes/pdm-gap-fill-routes.js", functionName: "registerPdmGapFillRoutes",
    getDeps: () => ({ db, generalApiRateLimit, writeOperationRateLimit, wsServer: getWebSocketServer() }) },

  // ===== Legacy routers wrapped to standard registerFn(app, deps) signature =====

  { name: "BeastMode", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerBeastRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
  { name: "Governance", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerGovernanceRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
  { name: "ComplianceLegacy", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerComplianceLegacyRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "SensorBundles", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerSensorBundlesRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
  { name: "SensorTemplates", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerSensorTemplatesRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
  { name: "Suppliers", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerSuppliersRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "Purchasing", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPurchasingRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "ServiceOrders", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerServiceOrdersRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "Diagnostics", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerDiagnosticsRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
  { name: "MlAiStudio", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerMlAiStudioRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "AgentLegacy", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerAgentLegacyRoutes",
    getDeps: () => ({}) },
  { name: "PdmDashboard", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPdmDashboardRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "PdmFeatureStore", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPdmFeatureStoreRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "PdmFleetAnalytics", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPdmFleetAnalyticsRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "PdmModelRegistry", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPdmModelRegistryRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "PdmInference", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPdmInferenceRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "PdmMonitoring", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPdmMonitoringRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "TwinDefinition", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerTwinDefinitionRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "TwinState", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerTwinStateRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "ResidualAnalysis", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerResidualAnalysisRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "ScenarioSim", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerScenarioSimRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "Replay", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerReplayRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "TwinUpdates", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerTwinUpdatesRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "TrainingPipeline", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerTrainingPipelineRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "EquipmentIntelligence", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerEquipmentIntelligenceRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "PredictionGovernance", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerPredictionGovernanceRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
  { name: "AmosImport", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerAmosImportRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
  { name: "ShipmateImport", importPath: "../routes/legacy-router-wrappers.js", functionName: "registerShipmateImportRoutes",
    getDeps: () => ({}) },
  { name: "ScheduledReports", importPath: "../domains/scheduled-reports/index.js", functionName: "registerScheduledReportsRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }) },
];

/**
 * Register all domain routers
 */
export async function registerAllDomainRouters(app: Express): Promise<void> {
  console.log("→ Registering domain routers...");
  
  for (const config of domainRouters) {
    try {
      const mod = await import(config.importPath);
      const registerFn = mod[config.functionName];

      if (typeof registerFn !== "function") {
        console.error(`[Domain Registry] ${config.name}: Function ${config.functionName} not found in ${config.importPath}`);
        continue;
      }

      const deps = config.getDeps();
      await registerFn(app, deps);
    } catch (error) {
      console.error(`[Domain Registry] Failed to register ${config.name}:`, error);
    }
  }
  
  console.log(`✓ Domain routers registered (${domainRouters.length} modules)`);
}
