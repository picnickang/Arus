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

import { createLogger } from "./lib/structured-logger";
const logger = createLogger("Routes");
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
import { isPublicApiPath } from "./bootstrap/public-api-paths";

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
    logger.warn("[SECURITY WARNING] Global tenant isolation middleware DISABLED for testing. " +
        "This creates a CRITICAL VULNERABILITY and should NEVER be used in production!");
  } else {
    app.use("/api", (req, res, next) => {
      if (isPublicApiPath(req)) {
        return next();
      }
      return requireOrgId(req, res, next);
    });
    logger.info("[Security] Global tenant isolation middleware registered (before all /api routes)");
  }

  const { initDtcIntegrationService } = await import("./dtc-integration-service");
  initDtcIntegrationService();

  // Observability routes MUST be registered BEFORE domain routers because several
  // domain routers mount at "/api" with router-level requireOrgId middleware
  // (e.g. Suppliers, Purchasing, MlAiStudio). That middleware would otherwise
  // run for /api/healthz and /api/readyz and reject them with 401.
  registerObservabilityRoutes(app);

  // Wave 5.9: web-vitals beacon receipt. Registered on both /api/v1
  // (primary) and /api (legacy mirror) so older clients keep working
  // during the deprecation window from Wave 0.5.
  const { createWebVitalsRouter } = await import("./observability/web-vitals-route");
  const webVitalsRouter = createWebVitalsRouter();
  app.use("/api/v1", webVitalsRouter);
  app.use("/api", webVitalsRouter);

  await registerAllDomainRouters(app);

  const httpServer = createServer(app);

  httpServer.on("connection", (socket) => {
    import("./index")
      .then(({ trackConnection }) => {
        trackConnection(socket);
      })
      .catch(() => {});
  });

  // Push B2 — opt-in Redis-backed fan-out. Default is the in-process
  // bus so single-instance dev deployments keep their pre-B2 behaviour.
  // When `WS_REDIS_FANOUT=true` we install the Redis bus before the WS
  // server boots so its first subscriptions land on the right substrate.
  if (process.env['WS_REDIS_FANOUT'] === "true") {
    const [{ setFanoutBus }, { RedisFanoutBus }] = await Promise.all([
      import("./websocket-fanout"),
      import("./websocket-fanout-redis"),
    ]);
    setFanoutBus(new RedisFanoutBus());
  }
  const wsServer = new TelemetryWebSocketServer(httpServer);
  setWebSocketServer(wsServer);
  startPerformanceMonitoring();

  return httpServer;
}
