/**
 * Inline Routes - Dev-only and infrastructure routes
 *
 * Production-facing routes have been migrated to the domain router registry.
 * Only dev-only endpoints and infrastructure mounts remain here.
 */

import type { Express, Request, Response } from "express";
import { generalApiRateLimit } from "./route-dependencies";
import { cryptoRandom } from "@shared/crypto-random";
import { telemetryDlqRouter } from "./telemetry-dlq-routes";
import { telemetryIngestionRouter } from "./telemetry-ingestion-routes";

export function registerInlineRoutes(app: Express): void {
  if (process.env.NODE_ENV === "development") {
    app.post(
      "/api/dev/telemetry/stress-test",
      generalApiRateLimit,
      async (req: Request, res: Response) => {
        try {
          const { telemetryBatchWriter } = await import("../telemetry-batch-writer");

          const {
            messagesPerSecond = 500,
            durationSeconds = 5,
            sensorTypes = ["temperature", "pressure", "vibration"],
          } = req.body;

          console.log(
            `[DEV] Starting batch writer stress test: ${messagesPerSecond} msg/sec for ${durationSeconds}s`
          );

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
                unit:
                  sensorType === "temperature" ? "C" : sensorType === "pressure" ? "bar" : "mm/s",
                metadata: { stressTest: true, msgIndex: i },
              });
            }

            messagesSent = batchEnd;

            if (messagesSent % 1000 === 0) {
              await new Promise((r) => setImmediate(r));
            }
          }

          await new Promise((r) => setTimeout(r, 2000));

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
      }
    );
    console.log("[Inline Routes] DEV stress-test endpoint registered");
  }

  app.use("/api/telemetry/dlq", generalApiRateLimit, telemetryDlqRouter);
  app.use("/api/telemetry/ingestion", generalApiRateLimit, telemetryIngestionRouter);

  console.log("[Inline Routes] Registered (telemetry-dlq, telemetry-ingestion)");
}
