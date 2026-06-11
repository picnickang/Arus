import { createWorkflowAttentionSources } from "../composition/workflow-attention-sources.js";
import { loginRateLimit } from "../middleware/rate-limiters";
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

import type { DomainRouterConfig } from "./domain-router-config-types";

export const domainRouteRouters: DomainRouterConfig[] = [  // Software Updates
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
];
