/**
 * Domain Router Registry - Centralized domain router registration
 * Extracted from routes.ts for modularization
 * 
 * This file defines all domain routers and their dependencies in a declarative way,
 * dramatically reducing the main routes.ts file size.
 */

import type { Express } from "express";
import {
  storage,
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

// Type for domain router registration
interface DomainRouterConfig {
  name: string;
  importPath: string;
  functionName: string;
  getDeps: () => Record<string, any>;
}

// All domain routers with their dependencies
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

  // Compliance & Notifications
  { name: "Compliance", importPath: "../domains/compliance/index.js", functionName: "registerComplianceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Notifications", importPath: "../domains/notifications/index.js", functionName: "registerNotificationRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Integrations
  { name: "Integrations", importPath: "../domains/integrations/index.js", functionName: "registerIntegrationsRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, getFMCCService, updateFleetHealthScore }) },
  { name: "DTC", importPath: "../domains/dtc/index.js", functionName: "registerDtcRoutes",
    getDeps: () => ({ storage, writeOperationRateLimit, getWebSocketServer }) },

  // ML & Analytics
  { name: "MLAnalytics", importPath: "../domains/ml-analytics/index.js", functionName: "registerMlAnalyticsRoutes",
    getDeps: () => ({ storage, writeOperationRateLimit, schedulerEventBus, adaptiveTrainingWindow }) },
  { name: "CostSavings", importPath: "../domains/cost-savings/index.js", functionName: "registerCostSavingsRoutes",
    getDeps: () => ({ writeOperationRateLimit }) },
  { name: "ConditionMonitoring", importPath: "../domains/condition-monitoring/index.js", functionName: "registerConditionMonitoringRoutes",
    getDeps: () => ({ storage, generalApiRateLimit }) },

  // Sync
  { name: "Sync", importPath: "../domains/sync/index.js", functionName: "registerSyncRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit, getSyncMetrics, processPendingEvents, recordAndPublish }) },
  // NOTE: CrewExtensions MUST be registered BEFORE Scheduling to ensure
  // /api/schedule/runs is matched before the generic /api/schedule/:id
  { name: "CrewExtensions", importPath: "../domains/crew-extensions/index.js", functionName: "registerCrewExtensionsRoutes",
    getDeps: () => ({ storage, crewOperationRateLimit, criticalOperationRateLimit }) },
  { name: "Scheduling", importPath: "../domains/scheduling/index.js", functionName: "registerSchedulingRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },

  // Weather & External
  { name: "StormGeo", importPath: "../domains/stormgeo/index.js", functionName: "registerStormGeoRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },
  { name: "Vibration", importPath: "../domains/vibration/index.js", functionName: "registerVibrationRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit }) },
  // Sensor Management
  { name: "SensorManagement", importPath: "../domains/sensor-management/index.js", functionName: "registerSensorManagementRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit }) },

  // Hub Sync & Insights
  { name: "HubSync", importPath: "../domains/hub-sync/index.js", functionName: "registerHubSyncRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }) },
  { name: "InsightsV2", importPath: "../domains/insights/index.js", functionName: "registerInsightsV2Routes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, reportGenerationRateLimit }) },

  // LLM & ML Pipeline
  { name: "LLM", importPath: "../domains/llm/index.js", functionName: "registerLlmRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, reportGenerationRateLimit }) },
  { name: "MLPipeline", importPath: "../domains/ml-pipeline/index.js", functionName: "registerMlPipelineRoutes",
    getDeps: () => ({ storage, generalApiRateLimit }) },

  // Crew Extensions registered earlier (before Scheduling) for route priority
  // Vessel Performance
  { name: "VesselPerformance", importPath: "../domains/vessel-performance/index.js", functionName: "registerVesselPerformanceRoutes",
    getDeps: () => ({ storage, crewOperationRateLimit }) },

  // STCW Rest
  { name: "STCWRest", importPath: "../domains/stcw-rest/index.js", functionName: "registerStcwRestRoutes",
    getDeps: () => ({ storage, writeOperationRateLimit, checkMonthCompliance, normalizeRestDays, generatePdfFilename, renderRestPdf,
      incrementIdempotencyHit, incrementHorImport, incrementHorPdfExport, incrementRangeQuery, recordRangeQueryDuration }) },

  // IoT Processing
  { name: "IoTProcessing", importPath: "../domains/iot-processing/index.js", functionName: "registerIotProcessingRoutes",
    getDeps: () => ({ writeOperationRateLimit, mqttIngestionService, mlAnalyticsService, digitalTwinService }) },

  // System Admin
  { name: "SystemAdmin", importPath: "../domains/system-admin/index.js", functionName: "registerSystemAdminRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction,
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
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit }) },

  // Storage Config
  { name: "StorageConfig", importPath: "../domains/storage-config/index.js", functionName: "registerStorageConfigRoutes",
    getDeps: () => ({}) },

  // Autofill Logs
  { name: "AutofillLogs", importPath: "../domains/autofill-logs/index.js", functionName: "registerAutofillLogsRoutes",
    getDeps: () => ({ writeOperationRateLimit }) },

  // Health Monitoring
  { name: "HealthMonitoring", importPath: "../domains/health-monitoring/index.js", functionName: "registerHealthMonitoringRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit }) },

  // Settings
  { name: "Settings", importPath: "../domains/settings/index.js", functionName: "registerSettingsRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },

  // Permissions
  { name: "Permissions", importPath: "../domains/permissions/routes.js", functionName: "registerPermissionRoutes",
    getDeps: () => ({}) },

  // Class Survey Tracking
  { name: "Surveys", importPath: "../domains/surveys/routes.js", functionName: "registerSurveyRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit }) },

  // Home Attention Summary
  { name: "Home", importPath: "../routes/home-routes.js", functionName: "registerHomeRoutes",
    getDeps: () => ({ storage, generalApiRateLimit }) },

  // KB Ask (unified search + analyze)
  { name: "KbAsk", importPath: "../routes/kb-ask-route.js", functionName: "registerKbAskRoute",
    getDeps: () => ({ generalApiRateLimit }) },

  // AI Copilot Agent
  { name: "Agent", importPath: "../domains/agent/index.js", functionName: "registerAgentRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }) },

  // Purchasing Pipeline (read-only pipeline view)
  { name: "PurchasingPipeline", importPath: "../domains/purchasing/index.js", functionName: "registerPurchasingPipelineRoutes",
    getDeps: () => ({ generalApiRateLimit }) },
];

/**
 * Register all domain routers
 */
export async function registerAllDomainRouters(app: Express): Promise<void> {
  console.log("→ Registering domain routers...");
  
  for (const config of domainRouters) {
    try {
      const module = await import(config.importPath);
      const registerFn = module[config.functionName];
      
      if (typeof registerFn !== "function") {
        console.error(`[Domain Registry] ${config.name}: Function ${config.functionName} not found`);
        continue;
      }
      
      const deps = config.getDeps();
      
      // Special handling for alerts (needs different signature)
      if (config.name === "Alerts") {
        const { wsServer, ...otherDeps } = deps;
        registerFn(app, otherDeps, wsServer);
      } else if (config.name === "TelemetryIngestion") {
        const { requireValidOrgId: reqValid, validateHMAC: valHMAC, ...otherDeps } = deps;
        registerFn(app, otherDeps, { requireValidOrgId: reqValid, validateHMAC: valHMAC });
      } else if (config.name === "LLM") {
        registerFn(app, deps.storage, { generalApiRateLimit: deps.generalApiRateLimit, reportGenerationRateLimit: deps.reportGenerationRateLimit });
      } else {
        registerFn(app, deps);
      }
    } catch (error) {
      console.error(`[Domain Registry] Failed to register ${config.name}:`, error);
    }
  }
  
  console.log(`✓ Domain routers registered (${domainRouters.length} modules)`);
}
