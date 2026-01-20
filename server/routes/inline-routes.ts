/**
 * Inline Routes - Miscellaneous routes not part of domain modules
 * Extracted from routes.ts for modularization
 */

import type { Express, Request, Response } from "express";
import { generalApiRateLimit, storage } from "./route-dependencies";
import { cryptoRandom } from "@shared/crypto-random";
import { telemetryDlqRouter } from "./telemetry-dlq-routes";
import { telemetryIngestionRouter } from "./telemetry-ingestion-routes";

export function registerInlineRoutes(app: Express): void {
  // DEV ONLY: Direct batch writer stress test (bypasses auth for testing)
  if (process.env.NODE_ENV === "development") {
    app.post("/api/dev/telemetry/stress-test", generalApiRateLimit, async (req: Request, res: Response) => {
      try {
        const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
        
        const { 
          messagesPerSecond = 500, 
          durationSeconds = 5,
          sensorTypes = ["temperature", "pressure", "vibration"]
        } = req.body;

        console.log(`[DEV] Starting batch writer stress test: ${messagesPerSecond} msg/sec for ${durationSeconds}s`);

        const startStats = telemetryBatchWriter.getStats();
        const startTime = Date.now();
        let messagesSent = 0;
        const targetMessages = messagesPerSecond * durationSeconds;
        const batchSize = 100;

        while (messagesSent < targetMessages) {
          const batchEnd = Math.min(messagesSent + batchSize, targetMessages);
          
          for (let i = messagesSent; i < batchEnd; i++) {
            const sensorType = sensorTypes[i % sensorTypes.length];
            telemetryBatchWriter.queue({
              equipmentId: `stress-test-equipment-${i % 5}`,
              sensorType,
              value: 50 + cryptoRandom() * 50,
              timestamp: new Date(),
              orgId: "stress-test-org",
              unit: sensorType === "temperature" ? "C" : sensorType === "pressure" ? "bar" : "mm/s",
              metadata: { stressTest: true, msgIndex: i },
            });
          }
          
          messagesSent = batchEnd;
          
          if (messagesSent % 1000 === 0) {
            await new Promise(r => setImmediate(r));
          }
        }

        await new Promise(r => setTimeout(r, 2000));

        const endStats = telemetryBatchWriter.getStats();
        const elapsedMs = Date.now() - startTime;

        const result = {
          messagesSent,
          targetMessages,
          durationMs: elapsedMs,
          actualMsgPerSec: Math.round(messagesSent / (elapsedMs / 1000)),
          stats: {
            queued: endStats.totalQueued - startStats.totalQueued,
            flushed: endStats.totalFlushed - startStats.totalFlushed,
            evicted: endStats.totalEvicted - startStats.totalEvicted,
            errors: endStats.totalErrors - startStats.totalErrors,
            avgFlushDurationMs: endStats.avgFlushDurationMs,
            currentBufferSize: endStats.bufferSize,
          },
        };

        console.log(`[DEV] Stress test complete:`, result);

        res.json({
          success: true,
          result,
          note: "DEV ONLY - This endpoint bypasses auth and uses fake equipment IDs. Data goes to batch writer but may fail on DB insert due to FK constraints.",
        });
      } catch (error) {
        console.error("[DEV] Stress test failed:", error);
        res.status(500).json({ 
          error: "Stress test failed", 
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    console.log("[Inline Routes] DEV stress-test endpoint registered");
  }

  // MQTT Reliable Sync health endpoint
  app.get("/api/mqtt/reliable-sync/health", generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const { mqttReliableSync } = await import("../mqtt-reliable-sync");
      const healthStatus = mqttReliableSync.getHealthStatus();
      const metrics = mqttReliableSync.getMetrics();

      res.json({
        service: "MQTT Reliable Sync Service",
        status: healthStatus.status === "connected" ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        mqtt: healthStatus,
        detailedMetrics: metrics,
      });
    } catch (error) {
      res.status(500).json({
        service: "MQTT Reliable Sync Service",
        message: "Failed to get MQTT health status",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Load Distribution Analysis (VPS Feature)
  app.get("/api/equipment/:id/load-distribution", async (req: Request, res: Response) => {
    try {
      const equipmentId = req.params.id;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const equipment = await storage.getEquipment(equipmentId, orgId);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : defaultStart;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });
      }

      if (startDate > endDate) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }

      const { computeEquipmentLoadDistribution } = await import("../vps-kpi-service.js");

      const loadDistribution = await computeEquipmentLoadDistribution(equipmentId, orgId, {
        start: startDate,
        end: endDate,
      });

      const telemetry = await storage.getTelemetryByEquipment(
        equipmentId,
        startDate,
        endDate,
        orgId
      );

      const torqueCount = telemetry.filter(
        (t) => t.sensor_type === "shaft_torque" || t.sensor_type === "torque"
      ).length;

      res.setHeader("Cache-Control", "public, max-age=300");
      res.json({
        bins: loadDistribution,
        metadata: {
          equipmentId,
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          sampleCount: torqueCount,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          timezone: "UTC",
        },
      });
    } catch (error) {
      console.error("Failed to compute load distribution:", error);
      res.status(500).json({ message: "Failed to compute load distribution" });
    }
  });

  // Register Telemetry DLQ routes
  app.use("/api/telemetry/dlq", generalApiRateLimit, telemetryDlqRouter);

  // Register Telemetry Ingestion routes (archive, heartbeat, batch, schema)
  app.use("/api/telemetry/ingestion", generalApiRateLimit, telemetryIngestionRouter);

  console.log("[Inline Routes] Registered (mqtt-health, load-distribution, telemetry-dlq, telemetry-ingestion)");
}
