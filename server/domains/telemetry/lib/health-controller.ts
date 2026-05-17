/**
 * Telemetry Health Controller
 *
 * Provides health monitoring endpoints for telemetry infrastructure.
 * Exposes per-vessel ingestion rates, buffer status, and connection health.
 *
 * Features:
 * - Per-vessel ingestion rate tracking
 * - Buffer utilization monitoring
 * - Connection status aggregation
 * - 5-second polling friendly (not WebSocket)
 *
 * Module size: ~180 lines (target 100-250)
 */

import type { Express, Request, Response } from "express";
import { telemetryBufferManager } from "./buffer-manager";
import { telemetryRateLimiter } from "./rate-limiter";
import { logger } from "../../../utils/logger";

interface VesselIngestionStats {
  vesselId: string;
  messagesPerSecond: number;
  bufferSize: number;
  bufferUtilization: number;
  lastActivity: string | null;
  status: "healthy" | "warning" | "critical" | "inactive";
}

interface IngestionCounter {
  count: number;
  windowStart: number;
}

const RATE_WINDOW_MS = 10000;
const MAX_BUFFER_PER_VESSEL = 500;

class TelemetryHealthController {
  private ingestionCounters = new Map<string, IngestionCounter>();

  recordIngestion(vesselId: string, count: number = 1): void {
    const now = Date.now();
    let counter = this.ingestionCounters.get(vesselId);

    if (!counter || now - counter.windowStart > RATE_WINDOW_MS) {
      counter = { count: 0, windowStart: now };
      this.ingestionCounters.set(vesselId, counter);
    }

    counter.count += count;
  }

  getIngestionRate(vesselId: string): number {
    const counter = this.ingestionCounters.get(vesselId);
    if (!counter) {
      return 0;
    }

    const elapsed = Date.now() - counter.windowStart;
    if (elapsed <= 0) {
      return 0;
    }

    return (counter.count / elapsed) * 1000;
  }

  getVesselHealth(vesselId: string): VesselIngestionStats {
    const bufferStats = telemetryBufferManager.getVesselStats(vesselId);
    const rate = this.getIngestionRate(vesselId);
    const bufferSize = bufferStats?.bufferSize ?? 0;
    const utilization = bufferSize / MAX_BUFFER_PER_VESSEL;

    let status: VesselIngestionStats["status"] = "healthy";
    if (!bufferStats?.lastActivity) {
      status = "inactive";
    } else if (utilization > 0.9) {
      status = "critical";
    } else if (utilization > 0.7 || rate > 50) {
      status = "warning";
    }

    return {
      vesselId,
      messagesPerSecond: Math.round(rate * 100) / 100,
      bufferSize,
      bufferUtilization: Math.round(utilization * 100) / 100,
      lastActivity: bufferStats?.lastActivity?.toISOString() ?? null,
      status,
    };
  }

  getAllVesselHealth(): VesselIngestionStats[] {
    const allStats = telemetryBufferManager.getAllStats();
    const vesselIds = new Set<string>();

    for (const stat of allStats) {
      vesselIds.add(stat.vesselId);
    }
    for (const vesselId of this.ingestionCounters.keys()) {
      vesselIds.add(vesselId);
    }

    return Array.from(vesselIds).map((id) => this.getVesselHealth(id));
  }

  getSystemHealth(): {
    totalVessels: number;
    totalBufferSize: number;
    totalMessagesPerSecond: number;
    healthyVessels: number;
    warningVessels: number;
    criticalVessels: number;
    rateLimiterStats: { totalSensors: number };
  } {
    const vessels = this.getAllVesselHealth();
    let totalRate = 0;

    for (const v of vessels) {
      totalRate += v.messagesPerSecond;
    }

    return {
      totalVessels: vessels.length,
      totalBufferSize: telemetryBufferManager.getTotalBufferSize(),
      totalMessagesPerSecond: Math.round(totalRate * 100) / 100,
      healthyVessels: vessels.filter((v) => v.status === "healthy").length,
      warningVessels: vessels.filter((v) => v.status === "warning").length,
      criticalVessels: vessels.filter((v) => v.status === "critical").length,
      rateLimiterStats: telemetryRateLimiter.getStats(),
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [vesselId, counter] of this.ingestionCounters) {
      if (now - counter.windowStart > RATE_WINDOW_MS * 6) {
        this.ingestionCounters.delete(vesselId);
      }
    }
  }
}

export const telemetryHealthController = new TelemetryHealthController();

export function registerTelemetryHealthRoutes(app: Express): void {
  app.get("/api/telemetry/health", (_req: Request, res: Response) => {
    try {
      const health = telemetryHealthController.getSystemHealth();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        ...health,
      });
    } catch (err) {
      logger.error("TelemetryHealthController", "Failed to get health", err);
      res.status(500).json({ status: "error", message: "Failed to get telemetry health" });
    }
  });

  app.get("/api/telemetry/health/vessels", (_req: Request, res: Response) => {
    try {
      const vessels = telemetryHealthController.getAllVesselHealth();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        vessels,
      });
    } catch (err) {
      logger.error("TelemetryHealthController", "Failed to get vessel health", err);
      res.status(500).json({ status: "error", message: "Failed to get vessel health" });
    }
  });

  app.get("/api/telemetry/health/vessel/:vesselId", (req: Request, res: Response) => {
    try {
      const { vesselId } = req.params;
      const health = telemetryHealthController.getVesselHealth(vesselId);
      res.json({
        timestamp: new Date().toISOString(),
        ...health,
        status: "ok",
      });
    } catch (err) {
      logger.error("TelemetryHealthController", "Failed to get vessel health", err);
      res.status(500).json({ status: "error", message: "Failed to get vessel health" });
    }
  });

  setInterval(() => telemetryHealthController.cleanup(), 60000);

  logger.info("TelemetryHealthController", "Registered health routes");
}
