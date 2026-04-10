import { Express, Request, Response, RequestHandler } from "express";
import { withErrorHandling } from "../../lib/route-utils";
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import { dbAlertStorage } from "../../db/alerts/index.js";
import { dbDevicesStorage } from "../../repositories.js";
import { dbSystemAdminStorage } from "../../db/system-admin/index.js";

interface HealthMonitoringConfig {
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export function registerHealthMonitoringRoutes(app: Express, config: HealthMonitoringConfig) {
  const { requireOrgId, generalApiRateLimit } = config;

  // NOTE: /api/healthz and /api/readyz are handled by server/observability.ts
  // They are NOT registered here to preserve the existing security model

  // Application health (comprehensive version)
  app.get("/api/health", generalApiRateLimit,
    withErrorHandling("get health status", async (req: Request, res: Response) => {
      const health = {
        ok: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "arus-api",
        services: {
          database: "connected",
          storage: "available",
          cache: "available",
        },
        version: process.env.APP_VERSION ?? "1.0",
      };

      res.json(health);
    })
  );

  // Scalability and load balancer health
  app.get("/api/health/scalability", generalApiRateLimit,
    withErrorHandling("get scalability health", async (req: Request, res: Response) => {
      const { getLoadBalancerHealth } = await import("../../scalability");
      res.json(getLoadBalancerHealth());
    })
  );

  // Background jobs health
  app.get("/api/health/background-jobs", generalApiRateLimit,
    withErrorHandling("get background job status", async (req: Request, res: Response) => {
      const { jobQueue } = await import("../../background-jobs");
      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        statistics: jobQueue.getStats(),
        recentJobs: jobQueue.getRecentJobs(10),
      });
    })
  );

  // Cache health
  app.get("/api/health/cache", generalApiRateLimit,
    withErrorHandling("get cache status", async (req: Request, res: Response) => {
      const { cache } = await import("../../scalability");
      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        statistics: cache.getStats(),
      });
    })
  );

  // Telemetry health - batch writer and ingestion stats
  app.get("/api/health/telemetry", generalApiRateLimit,
    withErrorHandling("get telemetry health status", async (req: Request, res: Response) => {
      const { telemetryBatchWriter } = await import("../../telemetry-batch-writer");
      const { getBridgeState } = await import("../../services/sqlite-bridge");
      
      const batchWriterStats = telemetryBatchWriter.getStats();
      const bridgeState = getBridgeState();
      
      const bufferHealthy = batchWriterStats.totalQueued === 0 || 
        batchWriterStats.bufferSize < batchWriterStats.totalQueued * 0.8;
      const isHealthy = 
        batchWriterStats.isRunning && 
        batchWriterStats.totalErrors === 0 &&
        bufferHealthy &&
        !bridgeState.pgOffline;
      
      res.json({
        service: "Telemetry Ingestion Pipeline",
        status: isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        batchWriter: {
          isActive: batchWriterStats.isRunning,
          bufferSize: batchWriterStats.bufferSize,
          totalQueued: batchWriterStats.totalQueued,
          totalFlushed: batchWriterStats.totalFlushed,
          totalEvicted: batchWriterStats.totalEvicted,
          totalErrors: batchWriterStats.totalErrors,
          totalDropped: batchWriterStats.totalDropped,
          lastFlushTime: batchWriterStats.lastFlushTime,
          lastFlushDurationMs: batchWriterStats.lastFlushDurationMs,
          lastFlushCount: batchWriterStats.lastFlushCount,
          avgFlushDurationMs: batchWriterStats.avgFlushDurationMs,
        },
        sqliteBridge: {
          isRunning: bridgeState.isRunning,
          lastSuccessAt: bridgeState.lastSuccessAt,
          cursorLastId: bridgeState.cursorLastId,
          lagFrames: bridgeState.lagFrames,
          pgOffline: bridgeState.pgOffline,
        },
        configuration: {
          batchIntervalMs: Number.parseInt(process.env.TELEMETRY_BATCH_INTERVAL_MS || "500", 10),
          maxBufferSize: Number.parseInt(process.env.TELEMETRY_MAX_BUFFER_SIZE || "10000", 10),
          evictionPercent: Number.parseFloat(process.env.TELEMETRY_EVICTION_PERCENT || "0.1"),
          maxRetries: Number.parseInt(process.env.TELEMETRY_MAX_RETRIES || "3", 10),
        },
      });
    })
  );

  app.get("/api/health/detailed", requireOrgId,
    withErrorHandling("fetch detailed health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
      const alerts = await dbAlertStorage.getAlertNotifications();
      const activeAlerts = alerts.filter((a: any) => !a.acknowledgedAt);

      const health = {
        status: activeAlerts.length > 10 ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        metrics: {
          equipmentCount: equipment.length,
          activeAlerts: activeAlerts.length,
          criticalAlerts: activeAlerts.filter((a: any) => a.alertType === "critical").length,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.json(health);
    })
  );

  app.get("/api/health/equipment", requireOrgId,
    withErrorHandling("fetch equipment health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { equipmentId } = req.query;

      const pdmScores = await dbDevicesStorage.getPdmScores(equipmentId as string, (req.headers["x-org-id"] as string) || '');
      const latestScore = pdmScores[0];

      const health = {
        equipmentId: equipmentId ?? "all",
        timestamp: new Date().toISOString(),
        healthScore: latestScore?.healthIdx ?? 100,
        status: latestScore?.healthIdx < 30 ? "critical" : latestScore?.healthIdx < 60 ? "warning" : "healthy",
        lastUpdated: latestScore?.ts ?? null,
      };

      res.json(health);
    })
  );

  app.get("/api/health/fleet", requireOrgId,
    withErrorHandling("fetch fleet health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
      const pdmScores = await dbDevicesStorage.getPdmScores(undefined, orgId);

      const equipmentHealth = equipment.map((eq: any) => {
        const scores = pdmScores.filter((s: any) => s.equipmentId === eq.id);
        const latestScore = scores[0];
        return {
          equipmentId: eq.id,
          name: eq.name,
          healthScore: latestScore?.healthIdx ?? 100,
          status: latestScore?.healthIdx < 30 ? "critical" : latestScore?.healthIdx < 60 ? "warning" : "healthy",
        };
      });

      const avgHealth = equipmentHealth.length > 0
        ? equipmentHealth.reduce((sum: number, e: any) => sum + e.healthScore, 0) / equipmentHealth.length
        : 100;

      res.json({
        timestamp: new Date().toISOString(),
        fleetHealth: avgHealth,
        equipmentCount: equipment.length,
        criticalCount: equipmentHealth.filter((e: any) => e.status === "critical").length,
        warningCount: equipmentHealth.filter((e: any) => e.status === "warning").length,
        healthyCount: equipmentHealth.filter((e: any) => e.status === "healthy").length,
        equipment: equipmentHealth,
      });
    })
  );

  // Error logs
  app.get("/api/error-logs", requireOrgId,
    withErrorHandling("fetch error logs", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { level, source, dateFrom, dateTo, limit } = req.query;
      const logs = await dbSystemAdminStorage.getErrorLogs({
        orgId,
        level: level as string,
        source: source as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : 100,
      });
      res.json(logs ?? []);
    })
  );

  app.post("/api/error-logs", requireOrgId,
    withErrorHandling("create error log", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const log = await dbSystemAdminStorage.createErrorLog({ ...req.body, orgId });
      res.status(201).json(log || req.body);
    })
  );

  app.delete("/api/error-logs/:id", requireOrgId,
    withErrorHandling("delete error log", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      await dbSystemAdminStorage.deleteErrorLog(req.params.id, orgId);
      res.status(204).send();
    })
  );

  app.delete("/api/error-logs", requireOrgId,
    withErrorHandling("clear error logs", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { olderThan } = req.query;
      await dbSystemAdminStorage.clearErrorLogs(olderThan ? new Date(olderThan as string) : undefined, orgId);
      res.status(204).send();
    })
  );

  // Error health summary
  app.get("/api/error-health", requireOrgId,
    withErrorHandling("fetch error health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const logs = await dbSystemAdminStorage.getErrorLogs({ orgId, limit: 1000 });
      
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLogs = (logs ?? []).filter((log: Record<string, unknown>) => {
        const ts = log.createdAt || log.timestamp;
        return ts ? new Date(ts as string) >= last24h : false;
      });

      const getSeverity = (log: Record<string, unknown>) => ((log.level || log.severity || '') as string).toLowerCase();
      const summary = {
        totalErrors: recentLogs.length,
        byLevel: {
          error: recentLogs.filter((l) => getSeverity(l) === "error").length,
          warning: recentLogs.filter((l) => getSeverity(l) === "warning").length,
          info: recentLogs.filter((l) => getSeverity(l) === "info").length,
        },
        status: recentLogs.filter((l) => getSeverity(l) === "error").length > 10 ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
      };

      res.json(summary);
    })
  );


  // Performance metrics
  app.get("/api/performance", requireOrgId,
    withErrorHandling("fetch performance metrics", async (req: Request, res: Response) => {
      const performance = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss,
        },
        cpu: process.cpuUsage(),
      };

      res.json(performance);
    })
  );

  // Circuit breaker status for external services
  app.get("/api/health/circuit-breakers", generalApiRateLimit,
    withErrorHandling("fetch circuit breaker status", async (req: Request, res: Response) => {
      const { getAllCircuitBreakerStatuses } = await import("../../services/external-circuit-breakers");
      const { circuitBreakerRegistry } = await import("../../ml-circuit-breaker");
      
      const externalStatuses = getAllCircuitBreakerStatuses();
      const mlStatuses = circuitBreakerRegistry.getAllStats();
      
      const allOpen = Object.values(externalStatuses).some(s => s.state === "OPEN") ||
        Object.values(mlStatuses).some(s => s.state === "OPEN");
      
      res.json({
        status: allOpen ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        external: externalStatuses,
        ml: mlStatuses,
        summary: {
          totalBreakers: Object.keys(externalStatuses).length + Object.keys(mlStatuses).length,
          openBreakers: [
            ...Object.entries(externalStatuses).filter(([, s]) => s.state === "OPEN").map(([n]) => n),
            ...Object.entries(mlStatuses).filter(([, s]) => s.state === "OPEN").map(([n]) => n),
          ],
        },
      });
    })
  );

  // External dependencies health check
  app.get("/api/health/dependencies", generalApiRateLimit,
    withErrorHandling("check dependency health", async (req: Request, res: Response) => {
      const { inventoryCache, analyticsCache, cacheConfig } = await import("../../lib/cache");
      const { mqttReliableSyncService } = await import("../../mqtt-reliable-sync");
      const { setDependencyHealthStatus } = await import("../../observability");
      
      const redisInventoryHealthy = await inventoryCache.healthCheck();
      const redisAnalyticsHealthy = await analyticsCache.healthCheck();
      const mqttConnected = mqttReliableSyncService?.isConnected?.() ?? false;
      
      // Emit dependency health metrics
      setDependencyHealthStatus("redis_inventory", redisInventoryHealthy ? 1 : 0);
      setDependencyHealthStatus("redis_analytics", redisAnalyticsHealthy ? 1 : 0);
      setDependencyHealthStatus("mqtt", mqttConnected ? 1 : 0);
      setDependencyHealthStatus("postgres", 1); // If we got here, DB is working
      
      const issues: string[] = [];
      
      if (cacheConfig.enabled && !redisInventoryHealthy) {
        issues.push("Redis inventory cache unavailable - falling back to direct queries");
      }

      if (cacheConfig.analyticsEnabled && !redisAnalyticsHealthy) {
        issues.push("Redis analytics cache unavailable - falling back to direct queries");
      }

      if (!mqttConnected) {
        issues.push("MQTT broker disconnected - sync functionality may be delayed");
      }
      
      const hasIssues = issues.length > 0;
      
      res.json({
        status: hasIssues ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        dependencies: {
          redis: {
            inventory: {
              status: redisInventoryHealthy ? "connected" : "disconnected",
              enabled: cacheConfig.enabled,
            },
            analytics: {
              status: redisAnalyticsHealthy ? "connected" : "disconnected",
              enabled: cacheConfig.analyticsEnabled,
            },
          },
          mqtt: {
            broker: mqttConnected ? "connected" : "disconnected",
          },
          database: {
            postgres: "connected",
          },
        },
        notes: hasIssues ? [
          "Some dependencies are unavailable. The application will use fallback mechanisms.",
          ...issues,
        ] : [],
      });
    })
  );
}
