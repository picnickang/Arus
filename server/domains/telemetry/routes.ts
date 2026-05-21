import type { Express } from "express";
import { z } from "zod";
import { dbTelemetryStorage, dbDevicesStorage, dbSensorsStorage } from "../../repositories";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

const telemetryQuerySchema = z.object({
  equipmentId: z.string().uuid().optional(),
  vesselId: z.string().uuid().optional(),
  hours: z.coerce.number().int().positive().default(24),
});

const latestTelemetryQuerySchema = z.object({
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  sensorType: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const telemetryHistoryParamSchema = z.object({
  equipmentId: z.string().min(1),
  sensorType: z.string().min(1),
});

const telemetryHistoryQuerySchema = z.object({
  hours: z.coerce.number().int().positive().optional(),
});

const sensorConfigQuerySchema = z.object({
  equipmentId: z.string().optional(),
  sensorType: z.string().optional(),
});

/**
 * Telemetry Domain Routes
 *
 * Handles telemetry data read operations:
 * - Latest readings query
 * - Telemetry history and trends
 * - Edge device heartbeats
 * - Bulk data cleanup
 *
 * Note: Complex telemetry ingestion routes with HMAC validation
 * and sensor configuration processing remain in routes.ts
 */
export function registerTelemetryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    criticalOperationRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    generalApiRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    telemetryRateLimit: import("../../lib/rate-limit-factory").RateLimit;
  }
) {
  const { criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== TELEMETRY READ ROUTES ==========

  // Get latest telemetry readings
  app.get(
    "/api/telemetry/latest",
    generalApiRateLimit,
    withErrorHandling("fetch latest telemetry readings", async (req, res) => {
      const { equipmentId, limit: l } = latestTelemetryQuerySchema.parse(req.query);
      const limit = l ?? 500;

      const readings = equipmentId
        ? await dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, limit)
        : [];

      res.json(readings);
    })
  );

  // Get telemetry trends (equipmentId is optional for fleet-wide view)
  app.get(
    "/api/telemetry/trends",
    generalApiRateLimit,
    withErrorHandling("fetch telemetry trends", async (req, res) => {
      const queryValidation = telemetryQuerySchema.parse(req.query);
      const { equipmentId, hours } = queryValidation;

      const trends = await dbTelemetryStorage.getTelemetryTrends(equipmentId, hours);
      res.json(trends);
    })
  );

  // Get telemetry history for equipment/sensor
  app.get(
    "/api/telemetry/history/:equipmentId/:sensorType",
    generalApiRateLimit,
    withErrorHandling("fetch telemetry history", async (req, res) => {
      const { equipmentId, sensorType } = telemetryHistoryParamSchema.parse(req.params);
      const { hours: h } = telemetryHistoryQuerySchema.parse(req.query);
      const hours = h ?? 24;
      const history = await dbTelemetryStorage.getTelemetryHistory(equipmentId, sensorType, hours);
      res.json(history);
    })
  );

  // Clear orphaned telemetry data
  app.delete(
    "/api/telemetry/cleanup",
    criticalOperationRateLimit,
    withErrorHandling("clear telemetry data", async (req, res) => {
      await dbTelemetryStorage.clearOrphanedTelemetryData();
      res.json({
        ok: true,
        message: "Telemetry data cleared successfully",
      });
    })
  );

  // ========== EDGE HEARTBEAT ROUTES ==========

  // Get all edge heartbeats
  app.get(
    "/api/edge/heartbeats",
    generalApiRateLimit,
    withErrorHandling("fetch heartbeats", async (req, res) => {
      const heartbeats = await dbDevicesStorage.getHeartbeatsByOrg();
      res.json(heartbeats);
    })
  );

  // ========== SENSOR CONFIGURATION ROUTES ==========

  // Get sensor configurations
  app.get(
    "/api/sensor-configs",
    generalApiRateLimit,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const orgId = req.orgId!;

      const configs = await dbSensorsStorage.getSensorConfigurations(
        orgId,
        equipmentId as string,
        sensorType as string
      );
      res.json(configs);
    })
  );

  // Get single sensor configuration
  app.get(
    "/api/sensor-config",
    generalApiRateLimit,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const orgId = req.orgId!;

      const configs = await dbSensorsStorage.getSensorConfigurations(
        orgId,
        equipmentId as string,
        sensorType as string
      );

      if (configs.length === 0) {
        return sendNotFound(res, "Sensor configuration");
      }

      res.json(configs[0]);
    })
  );

  logger.info(
    "TelemetryRoutes",
    "Telemetry read routes registered (readings: 4, heartbeats: 1, configs: 2)"
  );
}
