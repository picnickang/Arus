/**
 * Domain Router Registry - Centralized domain router registration
 * Extracted from routes.ts for modularization
 *
 * This file defines all domain routers and their dependencies in a declarative way,
 * dramatically reducing the main routes.ts file size.
 */

import type { Express } from "express";
import { createLogger } from "../lib/structured-logger";
import { createWorkflowAttentionSources } from "../composition/workflow-attention-sources.js";
import { loginRateLimit } from "../middleware/rate-limiters";
const logger = createLogger("Routes:DomainRouterRegistry");
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
 * CANONICAL PATTERN — Two registration modes:
 *
 * 1. registerFn mode — calls mod[functionName](app, deps):
 *   { name: "MyDomain", importPath: "../domains/my-domain/index.js",
 *     functionName: "registerMyRoutes",
 *     getDeps: () => ({ generalApiRateLimit }) },
 *
 * 2. Router-mount mode — does app.use(mountPath, ...middleware, router):
 *   { name: "MyRouter", importPath: "../my-module/routes.js",
 *     functionName: "myRouter", mountPath: "/api/my-module",
 *     middlewareKeys: ["generalApiRateLimit"],
 *     getDeps: () => ({ generalApiRateLimit }) },
 */

export interface DomainRouterConfig {
  name: string;
  importPath: string;
  functionName: string;
  getDeps: () => Record<string, unknown>;
  mountPath?: string;
  middlewareKeys?: string[];
}

export const domainRouters: DomainRouterConfig[] = [
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

  // Software Updates
  {
    name: "SoftwareUpdates",
    importPath: "../domains/software-updates/index.js",
    functionName: "registerSoftwareUpdatesRoutes",
    getDeps: () => ({
      generalApiRateLimit,
      writeOperationRateLimit,
      criticalOperationRateLimit,
      requireAdminAuth,
      auditAdminAction,
    }),
  },

  // Data Export
  {
    name: "DataExport",
    importPath: "../domains/data-export/index.js",
    functionName: "registerDataExportRoutes",
    getDeps: () => ({
      generalApiRateLimit,
      criticalOperationRateLimit,
      requireAdminAuth,
      auditAdminAction,
      upload,
    }),
  },

  // Inventory Optimization
  {
    name: "InventoryOptimization",
    importPath: "../domains/inventory-optimization/index.js",
    functionName: "registerInventoryOptimizationRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Storage Config
  {
    name: "StorageConfig",
    importPath: "../domains/storage-config/index.js",
    functionName: "registerStorageConfigRoutes",
    getDeps: () => ({}),
  },

  // Autofill Logs
  {
    name: "AutofillLogs",
    importPath: "../domains/autofill-logs/index.js",
    functionName: "registerAutofillLogsRoutes",
    getDeps: () => ({ writeOperationRateLimit }),
  },

  // Health Monitoring
  {
    name: "HealthMonitoring",
    importPath: "../domains/health-monitoring/index.js",
    functionName: "registerHealthMonitoringRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },

  // Settings
  {
    name: "Settings",
    importPath: "../domains/settings/index.js",
    functionName: "registerSettingsRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }),
  },

  // Vessel Intelligence Diagram Registry
  {
    name: "VesselDiagramRegistry",
    importPath: "../domains/vessel-diagram-registry/index.js",
    functionName: "registerVesselDiagramRegistryRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit, writeOperationRateLimit }),
  },

  // Permissions
  {
    name: "Permissions",
    importPath: "../domains/permissions/routes.js",
    functionName: "registerPermissionRoutes",
    getDeps: () => ({}),
  },

  // Class Survey Tracking
  {
    name: "Surveys",
    importPath: "../domains/surveys/routes.js",
    functionName: "registerSurveyRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Workflow Attention Inbox
  {
    name: "Workflow",
    importPath: "../domains/workflow/index.js",
    functionName: "registerWorkflowRoutes",
    getDeps: () => ({
      generalApiRateLimit,
      writeOperationRateLimit,
      requireOrgId,
      sources: createWorkflowAttentionSources(),
    }),
  },

  // Operator Experience Command Center (hexagonal workflow UX layer)
  {
    name: "OperatorExperience",
    importPath: "../domains/workflow/index.js",
    functionName: "registerOperatorExperienceRoutes",
    getDeps: () => ({
      generalApiRateLimit,
      writeOperationRateLimit,
      requireOrgId,
      sources: createWorkflowAttentionSources(),
    }),
  },

  // Home Attention Summary
  {
    name: "Home",
    importPath: "../routes/home-routes.js",
    functionName: "registerHomeRoutes",
    getDeps: () => ({ generalApiRateLimit, requireOrgId }),
  },

  // KB Ask (unified search + analyze)
  {
    name: "KbAsk",
    importPath: "../routes/kb-ask-route.js",
    functionName: "registerKbAskRoute",
    getDeps: () => ({ generalApiRateLimit }),
  },

  // AI Copilot Agent
  {
    name: "Agent",
    importPath: "../domains/agent/index.js",
    functionName: "registerAgentRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Purchasing Pipeline (read-only pipeline view)
  {
    name: "PurchasingPipeline",
    importPath: "../domains/purchasing/index.js",
    functionName: "registerPurchasingPipelineRoutes",
    getDeps: () => ({ generalApiRateLimit }),
  },

  // Certificate Registry (hexagonal)
  {
    name: "Certificates",
    importPath: "../domains/certificates/index.js",
    functionName: "registerCertificateRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Safety Bulletins (hexagonal, cloud-only) — powers the user-portal
  // "Safety Notices" + "Safety Status" cards with a real backend feed.
  {
    name: "SafetyBulletins",
    importPath: "../domains/safety-bulletins/index.js",
    functionName: "registerSafetyBulletinRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Crew Tasks (hexagonal, cloud-only) — assignable crew task tracker
  // surfaced as the "Tasks" view inside Crew Management.
  {
    name: "CrewTasks",
    importPath: "../domains/crew-tasks/index.js",
    functionName: "registerCrewTaskRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Safety Alarms (hexagonal, cloud-only) — admin-managed alarm types +
  // active vessel safety alarms with acknowledgement.
  {
    name: "SafetyAlarms",
    importPath: "../domains/safety-alarms/index.js",
    functionName: "registerSafetyAlarmRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Crew Admin (hexagonal, cloud-only) — roles, per-role dashboard configs,
  // user vessel assignments, and login credential admin.
  {
    name: "CrewAdmin",
    importPath: "../domains/crew-admin/index.js",
    functionName: "registerCrewAdminRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Me Portal (BFF) — role-aware user dashboard, tasks, visible safety
  // alarms, regular-user login, and self password change.
  {
    name: "MePortal",
    importPath: "../domains/me-portal/index.js",
    functionName: "registerMePortalRoutes",
    getDeps: () => ({ generalApiRateLimit, loginRateLimit }),
  },

  // Schematic Layout (hexagonal - vessel cross-section zone/slot config)
  {
    name: "SchematicLayout",
    importPath: "../domains/schematic-layout/index.js",
    functionName: "registerSchematicLayoutRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },

  // Logbook Corrections (correction workflow + immutable audit trail)
  {
    name: "LogbookCorrections",
    importPath: "../domains/logbook/index.js",
    functionName: "registerLogbookCorrectionRoutes",
    getDeps: () => ({}),
  },

  // Sensor Calibration Registry (PdM data quality)
  {
    name: "SensorCalibration",
    importPath: "../domains/sensors/index.js",
    functionName: "registerSensorCalibrationRoutes",
    getDeps: () => ({}),
  },

  // OSV-Specific Domains
  {
    name: "DpMonitoring",
    importPath: "../domains/dp/index.js",
    functionName: "registerDpRoutes",
    getDeps: () => ({}),
  },
  {
    name: "CharterCompliance",
    importPath: "../domains/charter/index.js",
    functionName: "registerCharterRoutes",
    getDeps: () => ({}),
  },
  {
    name: "Vetting",
    importPath: "../domains/vetting/index.js",
    functionName: "registerVettingRoutes",
    getDeps: () => ({}),
  },
  {
    name: "OffshoreOps",
    importPath: "../domains/offshore-ops/index.js",
    functionName: "registerOffshoreOpsRoutes",
    getDeps: () => ({}),
  },
  {
    name: "Efms",
    importPath: "../domains/efms/index.js",
    functionName: "registerEfmsRoutes",
    getDeps: () => ({}),
  },
  {
    name: "Rms",
    importPath: "../domains/rms/index.js",
    functionName: "registerRmsRoutes",
    getDeps: () => ({}),
  },

  // ===== Function-style routes (registerFn pattern) =====

  {
    name: "KnowledgeBase",
    importPath: "../routes/kb-routes.js",
    functionName: "registerKnowledgeBaseRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit }),
  },
  {
    name: "Rag",
    importPath: "../routes/rag-routes.js",
    functionName: "registerRagRoutes",
    getDeps: () => ({ generalApiRateLimit, reportGenerationRateLimit }),
  },
  {
    name: "RagSecurity",
    importPath: "../routes/rag-security-routes.js",
    functionName: "registerRagSecurityRoutes",
    getDeps: () => ({}),
  },
  {
    name: "InsightsLegacy",
    importPath: "../routes/insights-routes.js",
    functionName: "registerInsightsRoutes",
    getDeps: () => ({}),
  },
  {
    name: "EquipmentContext",
    importPath: "../routes/equipment-context-routes.js",
    functionName: "registerEquipmentContextRoutes",
    getDeps: () => ({}),
  },
  {
    name: "Analytics",
    importPath: "../routes/analytics.js",
    functionName: "mountAnalyticsRoutes",
    getDeps: () => ({}),
  },
  {
    name: "WoSoBridge",
    importPath: "../routes/wo-so-bridge-routes.js",
    functionName: "registerWoSoBridgeRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "ServiceRequests",
    importPath: "../routes/service-request-routes.js",
    functionName: "registerServiceRequestRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }),
  },
  {
    name: "PdmGapFill",
    importPath: "../routes/pdm-gap-fill-routes.js",
    functionName: "registerPdmGapFillRoutes",
    getDeps: () => ({
      db,
      generalApiRateLimit,
      writeOperationRateLimit,
      wsServer: getWebSocketServer(),
    }),
  },
  {
    name: "ScheduledReports",
    importPath: "../domains/scheduled-reports/index.js",
    functionName: "registerScheduledReportsRoutes",
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },

  // ===== Direct router mounts (mountPath mode — no wrapper layer) =====

  {
    name: "BeastMode",
    importPath: "../beast/index.js",
    functionName: "beastModeRouter",
    mountPath: "/api/beast",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "Governance",
    importPath: "../governance/routes.js",
    functionName: "default",
    mountPath: "/api/governance",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "ComplianceLegacy",
    importPath: "../compliance/routes.js",
    functionName: "default",
    mountPath: "/api/compliance",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "SensorBundles",
    importPath: "../routes/sensorBundles.js",
    functionName: "default",
    mountPath: "/api/sensor-bundles",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "SensorTemplates",
    importPath: "../routes/sensorTemplates.js",
    functionName: "default",
    mountPath: "/api/sensor-templates",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "Suppliers",
    importPath: "../suppliers/index.js",
    functionName: "suppliersRouter",
    mountPath: "/api",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "Purchasing",
    importPath: "../purchasing/index.js",
    functionName: "purchasingRouter",
    mountPath: "/api",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "ServiceOrders",
    importPath: "../service-orders/index.js",
    functionName: "serviceOrderRoutes",
    mountPath: "/api/service-orders",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "Diagnostics",
    importPath: "../routes/diagnostics.js",
    functionName: "default",
    mountPath: "/api/diagnostics",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "MlAiStudio",
    importPath: "../ml-routes.js",
    functionName: "mlRouter",
    mountPath: "/api",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "AgentLegacy",
    importPath: "../routes/agent-routes.js",
    functionName: "default",
    mountPath: "/api",
    middlewareKeys: [],
    getDeps: () => ({}),
  },

  // ===== PdM Domain — Direct router mounts =====

  {
    name: "PdmDashboard",
    importPath: "../pdm/routes.js",
    functionName: "pdmRouter",
    mountPath: "/api/pdm",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PdmFeatureStore",
    importPath: "../domains/pdm-platform/feature-store/routes.js",
    functionName: "featureStoreRouter",
    mountPath: "/api/pdm/features",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    // The PdM equipment-detail page's health query. Documented in
    // swagger/paths-pdm.ts long before it was implemented — keep this
    // mount or the page crashes on Vite's HTML 404 fallback.
    name: "PdmHealth",
    importPath: "../domains/pdm-platform/health/routes.js",
    functionName: "pdmHealthRouter",
    mountPath: "/api/pdm/health",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PdmFleetAnalytics",
    importPath: "../domains/pdm-platform/fleet-analytics/routes.js",
    functionName: "fleetAnalyticsRouter",
    mountPath: "/api/pdm/fleet",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PdmModelRegistry",
    importPath: "../domains/pdm-platform/model-registry/routes.js",
    functionName: "modelRegistryRouter",
    mountPath: "/api/pdm/models",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PdmInference",
    importPath: "../domains/pdm-platform/inference/routes.js",
    functionName: "inferenceRouter",
    mountPath: "/api/pdm/infer",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PdmDecisionSupport",
    importPath: "../domains/pdm-platform/decision-support/interfaces/routes.js",
    functionName: "pdmDecisionSupportRouter",
    mountPath: "/api/pdm/decision-support",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PdmMonitoring",
    importPath: "../domains/pdm-platform/monitoring/routes.js",
    functionName: "monitoringRouter",
    mountPath: "/api/pdm/drift",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "PredictionGovernance",
    importPath: "../domains/pdm-platform/prediction-governance/routes.js",
    functionName: "predictionGovernanceRouter",
    mountPath: "/api/pdm/governance",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "TrainingPipeline",
    importPath: "../domains/pdm-platform/training-pipeline/routes.js",
    functionName: "trainingPipelineRouter",
    mountPath: "/api/pdm/training",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },

  // ===== Digital Twin — Direct router mounts =====

  {
    name: "TwinDefinition",
    importPath: "../domains/pdm-platform/digital-twin/twin-definition/routes.js",
    functionName: "twinDefinitionRouter",
    mountPath: "/api/pdm/twin/def",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "TwinState",
    importPath: "../domains/pdm-platform/digital-twin/twin-state/routes.js",
    functionName: "twinStateRouter",
    mountPath: "/api/pdm/twin/state",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "ResidualAnalysis",
    importPath: "../domains/pdm-platform/digital-twin/residual-analysis/routes.js",
    functionName: "residualAnalysisRouter",
    mountPath: "/api/pdm/twin/residuals",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "ScenarioSim",
    importPath: "../domains/pdm-platform/digital-twin/scenario-sim/routes.js",
    functionName: "scenarioSimRouter",
    mountPath: "/api/pdm/twin/scenarios",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "Replay",
    importPath: "../domains/pdm-platform/digital-twin/replay/routes.js",
    functionName: "replayRouter",
    mountPath: "/api/pdm/twin/replay",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "TwinUpdates",
    importPath: "../domains/pdm-platform/twin-updates/routes.js",
    functionName: "twinUpdatesRouter",
    mountPath: "/api/pdm/twin/updates",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "Vessel3D",
    importPath: "../routes/vessel-3d-routes.js",
    functionName: "vessel3dRouter",
    mountPath: "/api/v1",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "EquipmentDependencies",
    importPath: "../routes/equipment-dependencies-routes.js",
    functionName: "equipmentDependenciesRouter",
    mountPath: "/api/v1",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "EquipmentCrossClass",
    importPath: "../routes/equipment-cross-class-routes.js",
    functionName: "equipmentCrossClassRouter",
    mountPath: "/api/v1",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },

  // ===== Other direct mounts =====

  {
    name: "EquipmentIntelligence",
    importPath: "../domains/equipment-intelligence/interfaces/routes.js",
    functionName: "default",
    mountPath: "/api/equipment-intelligence",
    middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    getDeps: () => ({ requireOrgId, generalApiRateLimit }),
  },
  {
    name: "AmosImport",
    importPath: "../import-adapters/amos/index.js",
    functionName: "amosImportRouter",
    mountPath: "/",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "ShipmateImport",
    importPath: "../import-adapters/shipmate/index.js",
    functionName: "shipmateImportRouter",
    mountPath: "/api/import/shipmate",
    middlewareKeys: [],
    getDeps: () => ({}),
  },

  {
    name: "MqttHealth",
    importPath: "./mqtt-health-routes.js",
    functionName: "mqttHealthRouter",
    mountPath: "/api/mqtt/reliable-sync",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },
  {
    name: "EquipmentLoadDistribution",
    importPath: "./equipment-load-distribution-routes.js",
    functionName: "equipmentLoadDistributionRouter",
    mountPath: "/api/equipment",
    middlewareKeys: ["generalApiRateLimit"],
    getDeps: () => ({ generalApiRateLimit }),
  },

  {
    name: "InfrastructureInline",
    importPath: "./inline-routes.js",
    functionName: "registerInlineRoutes",
    getDeps: () => ({}),
  },
];

/**
 * Register all domain routers.
 *
 * Two registration modes:
 * - registerFn mode (default): calls mod[functionName](app, deps)
 * - router-mount mode (mountPath set): does app.use(mountPath, ...middleware, mod[functionName])
 */
export async function registerAllDomainRouters(app: Express): Promise<void> {
  logger.info("→ Registering domain routers...");

  for (const config of domainRouters) {
    try {
      const mod = await import(config.importPath);
      const target = mod[config.functionName];

      if (!target) {
        logger.error(
          `[Domain Registry] ${config.name}: ${config.functionName} not found in ${config.importPath}`
        );
        continue;
      }

      const deps = config.getDeps();

      if (config.mountPath) {
        const middleware = (config.middlewareKeys ?? [])
          .map((k) => deps[k])
          .filter(Boolean) as import("express").RequestHandler[];
        app.use(config.mountPath, ...middleware, target as import("express").RequestHandler);
      } else {
        if (typeof target !== "function") {
          logger.error(
            `[Domain Registry] ${config.name}: ${config.functionName} is not a function`
          );
          continue;
        }
        await target(app, deps);
      }
    } catch (error) {
      logger.error(`[Domain Registry] Failed to register ${config.name}:`, undefined, error);
    }
  }

  logger.info(`✓ Domain routers registered (${domainRouters.length} modules)`);
}
