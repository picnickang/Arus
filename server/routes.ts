/**
 * ARUS API Routes - Thin Coordinator
 *
 * All route registration is handled by the domain router registry.
 * This file only handles:
 * - Global middleware (logging, metrics, audit, tenant isolation)
 * - DTC integration initialization
 * - Domain router registration (delegated to registry)
 * - Observability routes (healthz, readyz, metrics)
 * - HTTP server + WebSocket creation
 */

import type { Express } from "express";
import { createServer, type Server } from "node:http";

import {
  metricsMiddleware,
  initializeMetrics,
  loggingContextMiddleware,
  auditMiddleware,
  requireOrgId,
  setWebSocketServer,
  TelemetryWebSocketServer,
  startPerformanceMonitoring,
} from "./routes/route-dependencies";
import { registerObservabilityRoutes } from "./routes/observability-routes";
import { registerAllDomainRouters } from "./routes/domain-router-registry";

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
  initializeMetrics();

  app.use(loggingContextMiddleware());
  app.use(metricsMiddleware);
  app.use(auditMiddleware);

  const { registerSwaggerRoutes } = await import("./swagger.js");
  registerSwaggerRoutes(app);

  // Global Tenant Isolation Middleware - MUST be BEFORE ALL /api routes
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

  const { initDtcIntegrationService } = await import("./dtc-integration-service");
  initDtcIntegrationService();

  await registerAllDomainRouters(app);

  registerObservabilityRoutes(app);

  const httpServer = createServer(app);

  httpServer.on("connection", (socket) => {
    import("./index").then(({ trackConnection }) => {
      trackConnection(socket);
    }).catch(() => {});
  });

  const wsServer = new TelemetryWebSocketServer(httpServer);
  setWebSocketServer(wsServer);
  startPerformanceMonitoring();

  return httpServer;
}
