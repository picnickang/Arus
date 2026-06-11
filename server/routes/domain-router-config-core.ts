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
  mqttIngestionService,
  mlAnalyticsService,
  digitalTwinService,
  db,
  adminPasswordVerifySchema,
  adminPasswordChangeSchema,
  insertAdminAuditEventSchema,
  insertAdminSystemSettingSchema,
  insertIntegrationConfigSchema,
  insertMaintenanceWindowSchema,
  insertSystemPerformanceMetricSchema,
  configAuditLog,
} from "./route-dependencies";

import type { DomainRouterConfig } from "./domain-router-config-types";

export const coreDomainRouters: DomainRouterConfig[] = [
  // Core domain routers (basic CRUD)
  {
    name: "WorkOrder",
    importPath: "../domains/work-orders/index.js",
    functionName: "registerWorkOrderRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Equipment",
    importPath: "../domains/equipment/index.js",
    functionName: "registerEquipmentRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "FleetRegistry",
    importPath: "../modules/fleet-registry/index.js",
    functionName: "registerFleetRegistryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Devices",
    importPath: "../domains/devices/index.js",
    functionName: "registerDeviceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Maintenance",
    importPath: "../domains/maintenance/index.js",
    functionName: "registerMaintenanceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    // Checklist/worklog routes the client has always called but which were
    // never registered — see docs/qa/route-contract-triage.md.
    name: "MaintenanceChecklists",
    importPath: "../domains/maintenance/index.js",
    functionName: "registerChecklistRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Inventory",
    importPath: "../domains/inventory/index.js",
    functionName: "registerInventoryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Crew",
    importPath: "../domains/crew/index.js",
    functionName: "registerCrewRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },

  // Alerts (special - needs websocket)
  {
    name: "Alerts",
    importPath: "../domains/alerts/index.js",
    functionName: "registerAlertsRoutes",
    getDeps: () => ({
      writeOperationRateLimit,
      criticalOperationRateLimit,
      generalApiRateLimit,
      wsServer: getWebSocketServer(),
    }),
  },
  {
    name: "AlertSettings",
    importPath: "../domains/alerts/index.js",
    functionName: "registerAlertSettingsRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },

  // Logbook & Telemetry
  {
    name: "Logbook",
    importPath: "../domains/logbook/index.js",
    functionName: "registerLogbookRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Telemetry",
    importPath: "../domains/telemetry/index.js",
    functionName: "registerTelemetryRoutes",
    getDeps: () => ({
      writeOperationRateLimit,
      criticalOperationRateLimit,
      generalApiRateLimit,
      telemetryRateLimit,
    }),
  },
  {
    name: "TelemetryIngestion",
    importPath: "../domains/telemetry/ingestion-routes.js",
    functionName: "registerTelemetryIngestionRoutes",
    getDeps: () => ({
      writeOperationRateLimit,
      criticalOperationRateLimit,
      generalApiRateLimit,
      telemetryRateLimit,
      requireValidOrgId,
      validateHMAC,
    }),
  },
  {
    name: "TelemetryHealth",
    importPath: "../domains/telemetry/lib/health-controller.js",
    functionName: "registerTelemetryHealthRoutes",
    getDeps: () => ({}),
  },

  // Compliance & Notifications
  {
    name: "Compliance",
    importPath: "../domains/compliance/index.js",
    functionName: "registerComplianceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "Notifications",
    importPath: "../domains/notifications/index.js",
    functionName: "registerNotificationRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }),
  },

  // Integrations
  {
    name: "Integrations",
    importPath: "../domains/integrations/index.js",
    functionName: "registerIntegrationsRoutes",
    getDeps: () => ({ generalApiRateLimit, getFMCCService, updateFleetHealthScore }),
  },
  {
    name: "DTC",
    importPath: "../domains/dtc/index.js",
    functionName: "registerDtcRoutes",
    getDeps: () => ({ writeOperationRateLimit, getWebSocketServer }),
  },

  // ML & Analytics
  {
    name: "MLAnalytics",
    importPath: "../domains/ml-analytics/index.js",
    functionName: "registerMlAnalyticsRoutes",
    getDeps: () => ({ writeOperationRateLimit, schedulerEventBus, adaptiveTrainingWindow }),
  },
  {
    name: "CostSavings",
    importPath: "../domains/cost-savings/index.js",
    functionName: "registerCostSavingsRoutes",
    getDeps: () => ({ writeOperationRateLimit }),
  },
  {
    name: "ConditionMonitoring",
    importPath: "../domains/condition-monitoring/index.js",
    functionName: "registerConditionMonitoringRoutes",
    getDeps: () => ({ generalApiRateLimit }),
  },

  // Sync
  {
    name: "Sync",
    importPath: "../domains/sync/index.js",
    functionName: "registerSyncRoutes",
    getDeps: () => ({
      generalApiRateLimit,
      writeOperationRateLimit,
      getSyncMetrics,
      processPendingEvents,
      recordAndPublish,
    }),
  },
  // NOTE: CrewExtensions MUST be registered BEFORE Scheduling to ensure
  // /api/schedule/runs is matched before the generic /api/schedule/:id
  {
    name: "CrewExtensions",
    importPath: "../domains/crew-extensions/index.js",
    functionName: "registerCrewExtensionsRoutes",
    getDeps: () => ({ crewOperationRateLimit, criticalOperationRateLimit }),
  },
  {
    name: "Scheduling",
    importPath: "../domains/scheduling/index.js",
    functionName: "registerSchedulingRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }),
  },

  // Weather & External
  {
    name: "StormGeo",
    importPath: "../domains/stormgeo/index.js",
    functionName: "registerStormGeoRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }),
  },
  {
    name: "Vibration",
    importPath: "../domains/vibration/index.js",
    functionName: "registerVibrationRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  // Sensor Management
  {
    name: "SensorManagement",
    importPath: "../domains/sensor-management/index.js",
    functionName: "registerSensorManagementRoutes",
    getDeps: () => ({
      requireOrgId,
      generalApiRateLimit,
      writeOperationRateLimit,
      criticalOperationRateLimit,
    }),
  },

  // Hub Sync & Insights
  {
    name: "HubSync",
    importPath: "../domains/hub-sync/index.js",
    functionName: "registerHubSyncRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "InsightsV2",
    importPath: "../domains/insights/index.js",
    functionName: "registerInsightsV2Routes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, reportGenerationRateLimit }),
  },

  // LLM & ML Pipeline
  {
    name: "LLM",
    importPath: "../domains/llm/index.js",
    functionName: "registerLlmRoutes",
    getDeps: () => ({ generalApiRateLimit, reportGenerationRateLimit }),
  },
  {
    name: "MLPipeline",
    importPath: "../domains/ml-pipeline/index.js",
    functionName: "registerMlPipelineRoutes",
    getDeps: () => ({ generalApiRateLimit }),
  },

  // Crew Extensions registered earlier (before Scheduling) for route priority
  // Vessel Performance
  {
    name: "VesselPerformance",
    importPath: "../domains/vessel-performance/index.js",
    functionName: "registerVesselPerformanceRoutes",
    getDeps: () => ({ crewOperationRateLimit }),
  },

  // STCW Rest
  {
    name: "STCWRest",
    importPath: "../domains/stcw-rest/index.js",
    functionName: "registerStcwRestRoutes",
    getDeps: () => ({
      writeOperationRateLimit,
      checkMonthCompliance,
      normalizeRestDays,
      generatePdfFilename,
      renderRestPdf,
      incrementIdempotencyHit,
      incrementHorImport,
      incrementHorPdfExport,
      incrementRangeQuery,
      recordRangeQueryDuration,
    }),
  },

  // IoT Processing
  {
    name: "IoTProcessing",
    importPath: "../domains/iot-processing/index.js",
    functionName: "registerIotProcessingRoutes",
    getDeps: () => ({
      writeOperationRateLimit,
      mqttIngestionService,
      mlAnalyticsService,
      digitalTwinService,
    }),
  },

  // System Admin
  {
    name: "SystemAdmin",
    importPath: "../domains/system-admin/index.js",
    functionName: "registerSystemAdminRoutes",
    getDeps: () => ({
      generalApiRateLimit,
      writeOperationRateLimit,
      criticalOperationRateLimit,
      requireAdminAuth,
      auditAdminAction,
      adminPasswordVerifySchema,
      adminPasswordChangeSchema,
      insertAdminAuditEventSchema,
      insertAdminSystemSettingSchema,
      insertIntegrationConfigSchema,
      insertMaintenanceWindowSchema,
      insertSystemPerformanceMetricSchema,
    }),
  },

  // Config Management
  {
    name: "ConfigManagement",
    importPath: "../domains/config-management/index.js",
    functionName: "registerConfigManagementRoutes",
    getDeps: () => ({
      db,
      configAuditLog,
      generalApiRateLimit,
      writeOperationRateLimit,
      criticalOperationRateLimit,
      requireAdminAuth,
      auditAdminAction,
    }),
  },
];
