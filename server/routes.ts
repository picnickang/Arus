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
import { beastModeRouter } from "./beast/index.js";
import governanceRouter from "./governance/routes.js";
import complianceRouter from "./compliance/routes";
import sensorBundlesRouter from "./routes/sensorBundles";
import sensorTemplatesRouter from "./routes/sensorTemplates";
import { mlRouter } from "./ml-routes";
import { purchasingRouter } from "./purchasing";
import { suppliersRouter } from "./suppliers";
import { serviceOrderRoutes } from "./service-orders";
import agentRoutes from "./routes/agent-routes";
import { pdmRouter } from "./pdm/routes";
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
    app.use("/api", requireOrgId);
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
