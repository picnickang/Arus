// @ts-nocheck
import { Request, Response } from "express";
import { structuredLog } from "../logging";
import { trackPerformance } from "./performance-tracking";
import { PERFORMANCE_THRESHOLDS } from "./core-metrics";

export function healthzEndpoint(req: Request, res: Response) {
  const isLocalMode = process.env.LOCAL_MODE === "true" || process.env.EMBEDDED_MODE === "true";
  const deploymentMode = isLocalMode ? "VESSEL" : "CLOUD";
  const databaseType = isLocalMode ? "SQLite" : "PostgreSQL";

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "unknown",
    deploymentMode,
    databaseType,
    environment: process.env.NODE_ENV || "development",
  });
}

type HealthStatus = "ready" | "degraded" | "not ready";

interface HealthContext {
  checks: Record<string, any>;
  overallStatus: HealthStatus;
  databaseType: string;
}

function degradeStatus(ctx: HealthContext): void {
  if (ctx.overallStatus === "ready") {
    ctx.overallStatus = "degraded";
  }
}

async function checkDatabase(ctx: HealthContext): Promise<void> {
  const dbStart = Date.now();
  try {
    const { db } = await import("../db");
    const { safeSql } = await import("../utils/safeSql");
    const { sql } = await import("drizzle-orm");
    await safeSql(db, sql`SELECT 1 as health_check`);
    ctx.checks.database = {
      status: "ok",
      type: ctx.databaseType,
      responseTimeMs: Date.now() - dbStart,
    };
  } catch (dbError) {
    ctx.checks.database = {
      status: "error",
      type: ctx.databaseType,
      responseTimeMs: Date.now() - dbStart,
      error: dbError instanceof Error ? dbError.message : "Unknown error",
    };
    ctx.overallStatus = "not ready";
  }
}

async function checkRedis(ctx: HealthContext): Promise<void> {
  const redisStart = Date.now();
  try {
    const { inventoryCache, analyticsCache, cacheConfig } = await import("../lib/cache");
    const inventoryHealthy = await inventoryCache.healthCheck();
    const analyticsHealthy = await analyticsCache.healthCheck();

    const redisOk = inventoryHealthy || analyticsHealthy;
    ctx.checks.redis = {
      status: redisOk ? "ok" : cacheConfig.enabled ? "degraded" : "disabled",
      responseTimeMs: Date.now() - redisStart,
      inventoryCache: inventoryHealthy ? "connected" : "disconnected",
      analyticsCache: analyticsHealthy ? "connected" : "disconnected",
      enabled: cacheConfig.enabled,
    };

    if (cacheConfig.enabled && !redisOk) {
      degradeStatus(ctx);
    }
  } catch (redisError) {
    ctx.checks.redis = {
      status: "error",
      responseTimeMs: Date.now() - redisStart,
      error: redisError instanceof Error ? redisError.message : "Unknown error",
    };
    degradeStatus(ctx);
  }
}

async function checkJobQueue(ctx: HealthContext): Promise<void> {
  try {
    const { jobQueueService } = await import("../job-queue-service");
    const queueHealth = jobQueueService.getHealthStatus();

    ctx.checks.jobQueue = {
      status: queueHealth.status,
      initialized: queueHealth.initialized,
      workerStarted: queueHealth.workerStarted,
    };

    if (
      queueHealth.status === "unavailable" ||
      !queueHealth.initialized ||
      !queueHealth.workerStarted
    ) {
      degradeStatus(ctx);
    }
  } catch (queueError) {
    ctx.checks.jobQueue = {
      status: "error",
      error: queueError instanceof Error ? queueError.message : "Unknown error",
    };
    degradeStatus(ctx);
  }
}

async function checkErrorHandling(ctx: HealthContext): Promise<void> {
  try {
    const { getErrorHandlingHealth } = await import("../error-handling");
    const errorHealth = getErrorHandlingHealth();
    const openCircuits = errorHealth.circuitBreakers.filter((cb) => cb.state === "OPEN").length;

    ctx.checks.errorHandling = {
      status: errorHealth.status,
      circuitBreakers: errorHealth.circuitBreakers.length,
      openCircuits,
    };

    if (openCircuits > 0) {
      degradeStatus(ctx);
    }
  } catch {
    ctx.checks.errorHandling = { status: "unknown" };
  }
}

function checkMemory(ctx: HealthContext): void {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const memoryWarning = heapUsedMB > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_MB;

  ctx.checks.memory = {
    status: memoryWarning ? "warning" : "ok",
    heapUsedMB,
    heapTotalMB,
    usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
  };
}

function addSchedulersCheck(ctx: HealthContext): void {
  ctx.checks.schedulers = {
    status: "ok",
    uptime: process.uptime(),
    scheduledJobs: [
      "insights (0 3 * * *)",
      "pdm (0 */6 * * *)",
      "ml-retraining (0 4 * * *)",
      "vessel-ops (0 0 * * *)",
      "data-reconciliation (60min)",
    ],
  };
}

export async function readyzEndpoint(req: Request, res: Response) {
  const start = Date.now();
  const isLocalMode = process.env.LOCAL_MODE === "true" || process.env.EMBEDDED_MODE === "true";
  const deploymentMode = isLocalMode ? "VESSEL" : "CLOUD";
  const databaseType = isLocalMode ? "SQLite" : "PostgreSQL";

  const ctx: HealthContext = {
    checks: {},
    overallStatus: "ready",
    databaseType,
  };

  try {
    await checkDatabase(ctx);
    await checkRedis(ctx);
    await checkJobQueue(ctx);
    await checkErrorHandling(ctx);
    checkMemory(ctx);
    addSchedulersCheck(ctx);

    const duration = Date.now() - start;
    trackPerformance("health_check", duration);

    const healthResponse = {
      status: ctx.overallStatus,
      timestamp: new Date().toISOString(),
      deploymentMode,
      databaseType,
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "unknown",
      checks: ctx.checks,
      features: {
        cloudOnlyFeatures: deploymentMode === "CLOUD",
        vesselMode: deploymentMode === "VESSEL",
        offlineCapable: isLocalMode,
      },
      performance: {
        uptime: process.uptime(),
        totalCheckDurationMs: duration,
      },
    };

    structuredLog("info", "Health check completed", {
      operation: "health_check",
      duration,
      metadata: { overallStatus: ctx.overallStatus, checksRun: Object.keys(ctx.checks).length },
    });

    const statusCode =
      ctx.overallStatus === "not ready" ? 503 : ctx.overallStatus === "degraded" ? 207 : 200;
    res.status(statusCode).json(healthResponse);
  } catch (error) {
    const duration = Date.now() - start;
    structuredLog("error", "Health check failed", {
      operation: "health_check",
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    res.status(503).json({
      status: "not ready",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      performance: { totalCheckDurationMs: duration },
    });
  }
}

export async function metricsEndpoint(req: Request, res: Response) {
  const client = await import("prom-client");
  try {
    res.set("Content-Type", client.default.register.contentType);
    const metrics = await client.default.register.metrics();
    res.send(metrics);
  } catch {
    res.status(500).send("Error collecting metrics");
  }
}

export async function dbIndexesHealthEndpoint(req: Request, res: Response) {
  try {
    const { verifyDatabaseIndexes } = await import("../db-indexes");
    const result = await verifyDatabaseIndexes();

    const statusCode = result.ok ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      verified: [],
      missing: [],
      lastCheckedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
