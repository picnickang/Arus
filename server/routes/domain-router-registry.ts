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
 * Domain Router Configuration Types
 *
 * CANONICAL PATTERN — Adding a new domain:
 *
 *   // Option A: Function-style (preferred for new domains)
 *   // Your file exports: export function registerMyRoutes(app: Express, deps: { ... }) { ... }
 *   { name: "MyDomain", importPath: "../domains/my-domain/index.js", functionName: "registerMyRoutes",
 *     getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },
 *
 *   // Option B: Router-mount (for Express Router objects)
 *   // Your file exports: export const myRouter = Router(); myRouter.get("/foo", ...)
 *   { name: "MyDomain", importPath: "../domains/my-domain/routes.js", exportName: "myRouter",
 *     mountPath: "/api/my-domain", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
 *
 * All routes are registered uniformly by registerAllDomainRouters() — no special cases.
 */

interface FunctionRouterConfig {
  name: string;
  importPath: string;
  functionName: string;
  getDeps: () => Record<string, any>;
}

interface RouterMountConfig {
  name: string;
  importPath: string;
  exportName: string;
  mountPath: string;
  getMiddleware: () => any[];
}

type DomainRouterConfig = FunctionRouterConfig | RouterMountConfig;

function isFunctionConfig(c: DomainRouterConfig): c is FunctionRouterConfig {
  return 'functionName' in c;
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

  // ===== Previously legacy Router-mount routes (migrated from routes.ts) =====

  { name: "BeastMode", importPath: "../beast/index.js", exportName: "beastModeRouter",
    mountPath: "/api/beast", getMiddleware: () => [generalApiRateLimit] },
  { name: "Governance", importPath: "../governance/routes.js", exportName: "default",
    mountPath: "/api/governance", getMiddleware: () => [generalApiRateLimit] },
  { name: "ComplianceLegacy", importPath: "../compliance/routes.js", exportName: "default",
    mountPath: "/api/compliance", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "SensorBundles", importPath: "../routes/sensorBundles.js", exportName: "default",
    mountPath: "/api/sensor-bundles", getMiddleware: () => [generalApiRateLimit] },
  { name: "SensorTemplates", importPath: "../routes/sensorTemplates.js", exportName: "default",
    mountPath: "/api/sensor-templates", getMiddleware: () => [generalApiRateLimit] },
  { name: "Suppliers", importPath: "../suppliers/index.js", exportName: "suppliersRouter",
    mountPath: "/api", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "Purchasing", importPath: "../purchasing/index.js", exportName: "purchasingRouter",
    mountPath: "/api", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "ServiceOrders", importPath: "../service-orders/index.js", exportName: "serviceOrderRoutes",
    mountPath: "/api/service-orders", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "Diagnostics", importPath: "../routes/diagnostics.js", exportName: "default",
    mountPath: "/api/diagnostics", getMiddleware: () => [generalApiRateLimit] },
  { name: "MlAiStudio", importPath: "../ml-routes.js", exportName: "mlRouter",
    mountPath: "/api", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "AgentLegacy", importPath: "../routes/agent-routes.js", exportName: "default",
    mountPath: "/api", getMiddleware: () => [] },
  { name: "PdmDashboard", importPath: "../pdm/routes.js", exportName: "pdmRouter",
    mountPath: "/api/pdm", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "PdmFeatureStore", importPath: "../domains/pdm-platform/feature-store/routes.js", exportName: "featureStoreRouter",
    mountPath: "/api/pdm/features", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "PdmFleetAnalytics", importPath: "../domains/pdm-platform/fleet-analytics/routes.js", exportName: "fleetAnalyticsRouter",
    mountPath: "/api/pdm/fleet", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "PdmModelRegistry", importPath: "../domains/pdm-platform/model-registry/routes.js", exportName: "modelRegistryRouter",
    mountPath: "/api/pdm/models", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "PdmInference", importPath: "../domains/pdm-platform/inference/routes.js", exportName: "inferenceRouter",
    mountPath: "/api/pdm/infer", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "PdmMonitoring", importPath: "../domains/pdm-platform/monitoring/routes.js", exportName: "monitoringRouter",
    mountPath: "/api/pdm/drift", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "TwinDefinition", importPath: "../domains/pdm-platform/digital-twin/twin-definition/routes.js", exportName: "twinDefinitionRouter",
    mountPath: "/api/pdm/twin/def", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "TwinState", importPath: "../domains/pdm-platform/digital-twin/twin-state/routes.js", exportName: "twinStateRouter",
    mountPath: "/api/pdm/twin/state", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "ResidualAnalysis", importPath: "../domains/pdm-platform/digital-twin/residual-analysis/routes.js", exportName: "residualAnalysisRouter",
    mountPath: "/api/pdm/twin/residuals", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "ScenarioSim", importPath: "../domains/pdm-platform/digital-twin/scenario-sim/routes.js", exportName: "scenarioSimRouter",
    mountPath: "/api/pdm/twin/scenarios", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "Replay", importPath: "../domains/pdm-platform/digital-twin/replay/routes.js", exportName: "replayRouter",
    mountPath: "/api/pdm/twin/replay", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "TwinUpdates", importPath: "../domains/pdm-platform/twin-updates/routes.js", exportName: "twinUpdatesRouter",
    mountPath: "/api/pdm/twin/updates", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "TrainingPipeline", importPath: "../domains/pdm-platform/training-pipeline/routes.js", exportName: "trainingPipelineRouter",
    mountPath: "/api/pdm/training", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "EquipmentIntelligence", importPath: "../domains/equipment-intelligence/interfaces/routes.js", exportName: "default",
    mountPath: "/api/equipment-intelligence", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "PredictionGovernance", importPath: "../domains/pdm-platform/prediction-governance/routes.js", exportName: "predictionGovernanceRouter",
    mountPath: "/api/pdm/governance", getMiddleware: () => [requireOrgId, generalApiRateLimit] },
  { name: "AmosImport", importPath: "../import-adapters/amos/index.js", exportName: "amosImportRouter",
    mountPath: "/", getMiddleware: () => [generalApiRateLimit] },
  { name: "ShipmateImport", importPath: "../import-adapters/shipmate/index.js", exportName: "shipmateImportRouter",
    mountPath: "/api/import/shipmate", getMiddleware: () => [] },

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

      if (isFunctionConfig(config)) {
        const registerFn = mod[config.functionName];
        if (typeof registerFn !== "function") {
          console.error(`[Domain Registry] ${config.name}: Function ${config.functionName} not found`);
          continue;
        }
        const deps = config.getDeps();
        registerFn(app, deps);
      } else {
        const router = mod[config.exportName];
        if (!router) {
          console.error(`[Domain Registry] ${config.name}: Export ${config.exportName} not found`);
          continue;
        }
        const middleware = config.getMiddleware();
        app.use(config.mountPath, ...middleware, router);
      }
    } catch (error) {
      console.error(`[Domain Registry] Failed to register ${config.name}:`, error);
    }
  }
  
  console.log(`✓ Domain routers registered (${domainRouters.length} modules)`);
}
