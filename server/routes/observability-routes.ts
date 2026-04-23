/**
 * Observability Routes - Health, metrics, and performance endpoints
 * Extracted from routes.ts for modularization
 */

import type { Express, Request, Response } from "express";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Routes:ObservabilityRoutes");
import {
  healthzEndpoint,
  readyzEndpoint,
  metricsEndpoint,
  dbIndexesHealthEndpoint,
  getErrorHandlingHealth,
} from "./route-dependencies";

export function registerObservabilityRoutes(app: Express): void {
  // Health check endpoints (no rate limiting for load balancers)
  app.get("/api/healthz", healthzEndpoint);
  app.get("/api/readyz", readyzEndpoint);

  // Error handling health endpoint
  app.get("/api/error-health", (req: Request, res: Response) => {
    try {
      const errorHandlingHealth = getErrorHandlingHealth();
      res.json({
        ...errorHandlingHealth,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to get error handling health",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Prometheus metrics endpoint
  app.get("/api/metrics", metricsEndpoint);

  // Database indexes health endpoint (Option A: verify-only, no DDL in prod)
  app.get("/api/health/db-indexes", dbIndexesHealthEndpoint);

  // Performance stats endpoint (no auth needed for ops monitoring)
  app.get("/api/performance/stats", async (req: Request, res: Response) => {
    try {
      const { performanceStatsHandler } = await import("../middleware/performance");
      return performanceStatsHandler(req, res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request span statistics endpoint - shows detailed request tracing (no auth for ops)
  app.get("/api/performance/spans", async (req: Request, res: Response) => {
    try {
      const { getRecentSlowRequests, getRequestSpans, getRequestSpanSummary } = await import(
        "../utils/request-spans"
      );
      const thresholdMs = Number.parseInt(req.query.thresholdMs as string) || 200;
      const requestId = req.query.requestId as string | undefined;

      if (requestId) {
        const spans = getRequestSpans(requestId);
        const summary = getRequestSpanSummary(requestId);
        res.json({
          requestId,
          spans,
          summary,
          timestamp: new Date().toISOString(),
        });
      } else {
        const slowRequests = getRecentSlowRequests(thresholdMs);
        res.json({
          slowRequests,
          thresholdMs,
          count: slowRequests.length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // SLO status endpoint - shows service level objectives and violations (no auth for ops)
  app.get("/api/performance/slo", async (req: Request, res: Response) => {
    try {
      const { getSLOStatus } = await import("../utils/slo-alerts");
      const status = getSLOStatus();

      res.json({
        ...status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  logger.info("[Observability Routes] Registered (healthz, readyz, metrics, error-health, performance, spans, slo, db-indexes)");
}
