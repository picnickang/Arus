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
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
    telemetryRateLimit: any;
  }
) {
  const { criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== TELEMETRY READ ROUTES ==========

  // Get latest telemetry readings
  app.get("/api/telemetry/latest", generalApiRateLimit,
    withErrorHandling("fetch latest telemetry readings", async (req, res) => {
      const vesselId = req.query.vesselId as string | undefined;
      const equipmentId = req.query.equipmentId as string | undefined;
      const sensorType = req.query.sensorType as string | undefined;
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 500;

      const readings = await (dbTelemetryStorage as any).getLatestTelemetryReadings(
        vesselId,
        equipmentId,
        sensorType,
        limit
      );

      res.json(readings);
    })
  );

  // Get telemetry trends (equipmentId is optional for fleet-wide view)
  app.get("/api/telemetry/trends", generalApiRateLimit,
    withErrorHandling("fetch telemetry trends", async (req, res) => {
      const queryValidation = telemetryQuerySchema.parse(req.query);
      const { equipmentId, hours } = queryValidation;

      const trends = await dbTelemetryStorage.getTelemetryTrends(equipmentId, hours);
      res.json(trends);
    })
  );

  // Get telemetry history for equipment/sensor
  app.get("/api/telemetry/history/:equipmentId/:sensorType", generalApiRateLimit,
    withErrorHandling("fetch telemetry history", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const hours = req.query.hours ? Number.parseInt(req.query.hours as string) : 24;
      const history = await dbTelemetryStorage.getTelemetryHistory(equipmentId, sensorType, hours);
      res.json(history);
    })
  );

  // Clear orphaned telemetry data
  app.delete("/api/telemetry/cleanup", criticalOperationRateLimit,
    withErrorHandling("clear telemetry data", async (req, res) => {
      await (dbTelemetryStorage as any).clearOrphanedTelemetryData();
      res.json({
        ok: true,
        message: "Telemetry data cleared successfully",
      });
    })
  );

  // ========== EDGE HEARTBEAT ROUTES ==========

  // Get all edge heartbeats
  app.get("/api/edge/heartbeats", generalApiRateLimit,
    withErrorHandling("fetch heartbeats", async (req, res) => {
      const heartbeats = await dbDevicesStorage.getHeartbeatsByOrg();
      res.json(heartbeats);
    })
  );

  // ========== SENSOR CONFIGURATION ROUTES ==========

  // Get sensor configurations
  app.get("/api/sensor-configs", generalApiRateLimit,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = req.query;
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
  app.get("/api/sensor-config", generalApiRateLimit,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = req.query;
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

  logger.info("TelemetryRoutes", "Telemetry read routes registered (readings: 4, heartbeats: 1, configs: 2)");
}
