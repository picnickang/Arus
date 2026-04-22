/**
 * Diagnostics Routes - Health Check Endpoints
 */

import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { runHealthChecks, determineOverallStatus, checkDatabase, startTime } from "./helpers.js";
import type { HealthCheckResult } from "./types.js";

export function registerHealthRoutes(router: Router) {
  router.get("/health", async (req: Request, res: Response) => {
    try {
      const checks = await runHealthChecks();
      const overallStatus = determineOverallStatus(checks);
      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0",
        uptime: Math.round((Date.now() - startTime) / 1000),
        checks,
      };
      const statusCode = overallStatus === "healthy" ? 200 : 503;
      if (overallStatus !== "healthy") {
        logger.warn("Diagnostics", `Health check returned ${overallStatus} status`, {
          checks: result.checks,
        });
      }
      res.status(statusCode).json(result);
    } catch (error) {
      logger.error(
        "Diagnostics",
        "Health check failed",
        error instanceof Error ? error : new Error(String(error))
      );
      res
        .status(503)
        .json({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: "Health check failed",
        });
    }
  });

  router.get("/health/liveness", (req: Request, res: Response) => {
    res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
  });

  router.get("/health/readiness", async (req: Request, res: Response) => {
    try {
      const dbCheck = await checkDatabase();
      if (dbCheck.status === "fail") {
        res
          .status(503)
          .json({
            status: "not_ready",
            reason: "Database unavailable",
            timestamp: new Date().toISOString(),
          });
        return;
      }
      res.status(200).json({ status: "ready", timestamp: new Date().toISOString() });
    } catch {
      res
        .status(503)
        .json({
          status: "not_ready",
          error: "Readiness check failed",
          timestamp: new Date().toISOString(),
        });
    }
  });
}
