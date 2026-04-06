/**
 * ARUS API Routes - Thin Coordinator
 * 
 * This file was refactored from 1,187 lines to ~150 lines (87% reduction)
 * All route logic has been extracted to:
 * - server/routes/route-dependencies.ts - Shared imports and dependencies
 * - server/routes/observability-routes.ts - Health/metrics endpoints  
 * - server/routes/inline-routes.ts - Miscellaneous inline routes
 * - server/routes/domain-router-registry.ts - Domain router registration
 */

import type { Express } from "express";
import { createServer, type Server } from "node:http";

// Centralized dependencies
import {
  metricsMiddleware,
  initializeMetrics,
  loggingContextMiddleware,
  auditMiddleware,
  requireOrgId,
  storage,
  setWebSocketServer,
  TelemetryWebSocketServer,
  startPerformanceMonitoring,
  generalApiRateLimit,
} from "./routes/route-dependencies";

// Extracted route modules
import { registerObservabilityRoutes } from "./routes/observability-routes";
import { registerInlineRoutes } from "./routes/inline-routes";
import { registerAllDomainRouters } from "./routes/domain-router-registry";

// Legacy route imports
import { registerKnowledgeBaseRoutes } from "./routes/kb-routes";
import { registerRagRoutes } from "./routes/rag-routes";
import { registerRagSecurityRoutes } from "./routes/rag-security-routes";
import { registerInsightsRoutes } from "./routes/insights-routes";
import { registerEquipmentContextRoutes } from "./routes/equipment-context-routes";
import { registerPdmGapFillRoutes } from "./routes/pdm-gap-fill-routes";
import { beastModeRouter } from "./beast/index.js";
import governanceRouter from "./governance/routes.js";
import complianceRouter from "./compliance/routes";
import sensorBundlesRouter from "./routes/sensorBundles";
import sensorTemplatesRouter from "./routes/sensorTemplates";
import { mlRouter } from "./ml-routes";
import { purchasingRouter } from "./purchasing";
import { suppliersRouter } from "./suppliers";
import { serviceOrderRoutes } from "./service-orders";
import { registerWoSoBridgeRoutes } from "./routes/wo-so-bridge-routes";
import { registerServiceRequestRoutes } from "./routes/service-request-routes";
import agentRoutes from "./routes/agent-routes";
import { pdmRouter } from "./pdm/routes";
import { featureStoreRouter } from "./domains/pdm-platform/feature-store/routes";
import { fleetAnalyticsRouter } from "./domains/pdm-platform/fleet-analytics/routes";
import { modelRegistryRouter } from "./domains/pdm-platform/model-registry/routes";
import { inferenceRouter } from "./domains/pdm-platform/inference/routes";
import { monitoringRouter } from "./domains/pdm-platform/monitoring/routes";
import { twinDefinitionRouter } from "./domains/pdm-platform/digital-twin/twin-definition/routes";
import { twinStateRouter } from "./domains/pdm-platform/digital-twin/twin-state/routes";
import { residualAnalysisRouter } from "./domains/pdm-platform/digital-twin/residual-analysis/routes";
import { scenarioSimRouter } from "./domains/pdm-platform/digital-twin/scenario-sim/routes";
import { replayRouter } from "./domains/pdm-platform/digital-twin/replay/routes";
import { predictionGovernanceRouter } from "./domains/pdm-platform/prediction-governance/routes";
import { twinUpdatesRouter } from "./domains/pdm-platform/twin-updates/routes";
import { trainingPipelineRouter } from "./domains/pdm-platform/training-pipeline/routes";
import {
  writeOperationRateLimit,
} from "./routes/route-dependencies";

/**
 * Register all application routes
 * 
 * @param app - Express application instance
 * @param options - Optional configuration
 * @param options.skipGlobalTenantIsolation - FOR TESTING ONLY: Skip global requireOrgId middleware
 */
export async function registerRoutes(
  app: Express,
  options: { skipGlobalTenantIsolation?: boolean } = {}
): Promise<Server> {
  // Initialize metrics collection
  initializeMetrics();

  // Add logging context middleware FIRST
  app.use(loggingContextMiddleware());

  // Add metrics middleware to track all requests
  app.use(metricsMiddleware);

  // Comprehensive audit middleware (must be early)
  app.use(auditMiddleware);

  // Register OpenAPI/Swagger documentation (public - before auth middleware)
  const { registerSwaggerRoutes } = await import("./swagger.js");
  registerSwaggerRoutes(app);

  // ==================================================================================
  // 🔒 Global Tenant Isolation Middleware - MUST be BEFORE ALL /api routes!
  // ==================================================================================
  if (options.skipGlobalTenantIsolation) {
    console.warn(
      "[SECURITY WARNING] Global tenant isolation middleware DISABLED for testing. " +
      "This creates a CRITICAL VULNERABILITY and should NEVER be used in production!"
    );
  } else {
    const publicPaths = new Set(["/healthz", "/readyz", "/health", "/metrics"]);
    app.use("/api", (req, res, next) => {
      if (publicPaths.has(req.path)) return next();
      return requireOrgId(req, res, next);
    });
    console.log("[Security] Global tenant isolation middleware registered (before all /api routes)");
  }

  // Initialize DTC Integration Service
  const { initDtcIntegrationService } = await import("./dtc-integration-service");
  initDtcIntegrationService(storage);

  // Mount Knowledge Base document management routes
  registerKnowledgeBaseRoutes(app, { generalApiRateLimit, writeOperationRateLimit });

  // Mount RAG (Retrieval-Augmented Generation) routes
  const { reportGenerationRateLimit } = await import("./routes/route-dependencies");
  registerRagRoutes(app, { generalApiRateLimit, reportGenerationRateLimit });

  // Mount RAG Security settings and management routes
  registerRagSecurityRoutes(app);

  // Mount Actionable Insights routes
  registerInsightsRoutes(app);

  // Mount Equipment Context aggregation routes
  registerEquipmentContextRoutes(app);

  // Mount analytics routes with Redis caching
  const { mountAnalyticsRoutes } = await import("./routes/analytics.js");
  mountAnalyticsRoutes(app);

  // Register all domain routers (50+ modules)
  await registerAllDomainRouters(app);

  // Register observability routes (health, metrics, performance)
  registerObservabilityRoutes(app);

  // Register inline routes (MQTT, VPS, dev endpoints)
  registerInlineRoutes(app);

  // Legacy router mounts
  app.use("/api/beast", generalApiRateLimit, beastModeRouter);
  app.use("/api/governance", generalApiRateLimit, governanceRouter);
  app.use("/api/compliance", requireOrgId, generalApiRateLimit, complianceRouter);
  app.use("/api/sensor-bundles", generalApiRateLimit, sensorBundlesRouter);
  app.use("/api/sensor-templates", generalApiRateLimit, sensorTemplatesRouter);

  // Suppliers management
  app.use("/api", requireOrgId, generalApiRateLimit, suppliersRouter);
  console.log("[Suppliers Routes] Registered (CRUD, search, performance)");

  // Purchasing (PR → PO workflow)
  app.use("/api", requireOrgId, generalApiRateLimit, purchasingRouter);
  console.log("[Purchasing Routes] Registered (PRs: 8, item-suppliers: 3)");

  // Service Orders (SR → SO workflow)
  app.use("/api/service-orders", requireOrgId, generalApiRateLimit, serviceOrderRoutes);
  console.log("[Service Orders Routes] Registered (CRUD, status transitions)");

  // WO ↔ SO Bridge (cross-entity linking)
  registerWoSoBridgeRoutes(app, { writeOperationRateLimit, generalApiRateLimit });
  console.log("[WO-SO Bridge] Registered (link, create-from-WO, sync-status)");

  registerServiceRequestRoutes(app, { writeOperationRateLimit, generalApiRateLimit });
  console.log("[Service Requests] Registered (CRUD, review, approve, reject, convert)");

  // Diagnostics & Health Check Routes
  const diagnosticsRouter = (await import("./routes/diagnostics")).default;
  app.use("/api/diagnostics", generalApiRateLimit, diagnosticsRouter);

  // ML AI Studio production routes
  app.use("/api", requireOrgId, generalApiRateLimit, mlRouter);

  // Agent & Ingestion monitoring routes (Phase A E2E Verification)
  app.use("/api", agentRoutes);
  console.log("[Agent Routes] Registered (agent/status, bridge/status, ingestion/verify)");

  // Predictive Maintenance Dashboard routes
  app.use("/api/pdm", requireOrgId, generalApiRateLimit, pdmRouter);
  console.log("[PdM Routes] Registered (dashboard, risk-queue, asset detail)");

  // PdM Platform routes
  app.use("/api/pdm/features", requireOrgId, generalApiRateLimit, featureStoreRouter);
  app.use("/api/pdm/fleet", requireOrgId, generalApiRateLimit, fleetAnalyticsRouter);
  app.use("/api/pdm/models", requireOrgId, generalApiRateLimit, modelRegistryRouter);
  app.use("/api/pdm/infer", requireOrgId, generalApiRateLimit, inferenceRouter);
  app.use("/api/pdm/drift", requireOrgId, generalApiRateLimit, monitoringRouter);
  console.log("[PdM Platform] Registered (feature-store, fleet-analytics, model-registry, inference, monitoring)");

  // Digital Twin routes
  app.use("/api/pdm/twin/def", requireOrgId, generalApiRateLimit, twinDefinitionRouter);
  app.use("/api/pdm/twin/state", requireOrgId, generalApiRateLimit, twinStateRouter);
  app.use("/api/pdm/twin/residuals", requireOrgId, generalApiRateLimit, residualAnalysisRouter);
  app.use("/api/pdm/twin/scenarios", requireOrgId, generalApiRateLimit, scenarioSimRouter);
  app.use("/api/pdm/twin/replay", requireOrgId, generalApiRateLimit, replayRouter);
  app.use("/api/pdm/twin/updates", requireOrgId, generalApiRateLimit, twinUpdatesRouter);
  console.log("[Digital Twin] Registered (definition, state, residuals, scenarios, replay, updates)");

  app.use("/api/pdm/training", requireOrgId, generalApiRateLimit, trainingPipelineRouter);
  console.log("[Training Pipeline] Registered (datasets, runs, promote, artifacts)");

  // Equipment Intelligence consolidated view
  const equipmentIntelligenceRouter = (await import("./domains/equipment-intelligence/interfaces/routes.js")).default;
  app.use("/api/equipment-intelligence", requireOrgId, generalApiRateLimit, equipmentIntelligenceRouter);
  console.log("[Equipment Intelligence] Registered (overview, detail)");

  // Prediction Governance routes
  app.use("/api/pdm/governance", requireOrgId, generalApiRateLimit, predictionGovernanceRouter);
  console.log("[Prediction Governance] Registered (list, review, approve, suppress, expire)");

  // PdM Gap Fill routes (calibration, outcomes, anomaly-groups, aggregation, evaluation, training-queue)
  const { db: gapFillDb, getWebSocketServer: getGapFillWs } = await import("./routes/route-dependencies");
  registerPdmGapFillRoutes(app, {
    storage,
    db: gapFillDb,
    generalApiRateLimit,
    writeOperationRateLimit,
    wsServer: getGapFillWs(),
  });
  console.log("[PdM Gap Fill] Registered (calibration, outcomes, anomaly-groups, aggregation, evaluation, training-queue)");

  // AMOS Import Adapter
  const { amosImportRouter } = await import("./import-adapters/amos/index");
  app.use(generalApiRateLimit, amosImportRouter);
  console.log("[AMOS Import] Registered (import, preview, mappings)");

  // SHIPMATE Import Adapter
  const { shipmateImportRouter } = await import("./import-adapters/shipmate/index");
  app.use("/api/import/shipmate", shipmateImportRouter);
  console.log("[SHIPMATE Import] Registered (import, preview, modules)");

  // Scheduled Reports domain
  const { createScheduledReportsDomain } = await import("./domains/scheduled-reports/index.js");
  const scheduledReportsDomain = createScheduledReportsDomain();
  app.use("/api/scheduled-reports", requireOrgId, generalApiRateLimit, scheduledReportsDomain.router);
  scheduledReportsDomain.initialize().catch((err) => console.error("[Scheduled Reports] Init failed:", err));
  console.log("[Scheduled Reports] Registered (CRUD, generation, delivery)");

  // Create HTTP server
  const httpServer = createServer(app);

  // Track connections for graceful shutdown with connection draining
  httpServer.on("connection", (socket) => {
    import("./index").then(({ trackConnection }) => {
      trackConnection(socket);
    }).catch(() => {});
  });

  // Initialize WebSocket server for real-time telemetry
  const wsServer = new TelemetryWebSocketServer(httpServer);

  // Store global reference for alert broadcasting
  setWebSocketServer(wsServer);

  // Start database performance monitoring
  startPerformanceMonitoring();

  return httpServer;
}
