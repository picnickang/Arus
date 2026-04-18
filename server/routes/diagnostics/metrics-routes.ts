/**
 * Diagnostics Routes - Metrics Endpoints
 */

import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { startTime } from "./helpers.js";
import type { SystemMetrics } from "./types.js";

export function registerMetricsRoutes(router: Router) {
  router.get("/metrics", async (req: Request, res: Response) => {
    try {
      const memoryUsage = process.memoryUsage();
      const metrics: SystemMetrics = {
        memory: {
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          externalMB: Math.round(memoryUsage.external / 1024 / 1024),
          utilizationPercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
        uptime: Math.round((Date.now() - startTime) / 1000),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      };
      res.json(metrics);
    } catch (error) {
      logger.error('Diagnostics', 'Metrics collection failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });

  router.get("/telemetry/stats", async (req: Request, res: Response) => {
    try {
      const { telemetryBatchWriter } = await import("../../telemetry-batch-writer.js");
      const stats = telemetryBatchWriter.getStats();
      res.json({
        batchWriter: stats,
        health: {
          bufferUtilization: stats.bufferSize > 0 ? Math.round((stats.currentBufferSize / stats.bufferSize) * 100) : 0,
          evictionRate: stats.totalQueued > 0 ? Math.round((stats.totalEvicted / stats.totalQueued) * 10000) / 100 : 0,
          writeSuccessRate: stats.totalQueued > 0 ? Math.round((stats.totalWritten / stats.totalQueued) * 10000) / 100 : 100,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Diagnostics', 'Telemetry stats collection failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to collect telemetry stats' });
    }
  });
}
