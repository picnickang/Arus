import type { Express } from "express";
import { z } from "zod";
import { TelemetryService } from "../application";
import { telemetryRepository } from "../infrastructure";
import type { ITelemetryExternalReads } from "../domain/ports";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";

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
 * Telemetry Domain Routes — telemetry read operations (latest, trends, baseline,
 * history, sensor-health, heartbeats, sensor configs). Calls the application
 * service only; cross-domain reads come via the injected external port.
 */
export function registerTelemetryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    criticalOperationRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    telemetryRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    external: ITelemetryExternalReads;
  }
) {
  const { criticalOperationRateLimit, generalApiRateLimit, external } = rateLimit;
  const service = new TelemetryService(telemetryRepository, external);

  // ========== TELEMETRY READ ROUTES ==========

  app.get(
    "/api/telemetry/latest",
    generalApiRateLimit,
    withErrorHandling("fetch latest telemetry readings", async (req, res) => {
      const { equipmentId, limit: l } = latestTelemetryQuerySchema.parse(req.query);
      const readings = await service.getLatestReadings(equipmentId, l ?? 500);
      res.json(readings);
    })
  );

  app.get(
    "/api/telemetry/trends",
    generalApiRateLimit,
    withErrorHandling("fetch telemetry trends", async (req, res) => {
      const { equipmentId, hours } = telemetryQuerySchema.parse(req.query);
      const trends = await service.getTrends(equipmentId, hours);
      res.json(trends);
    })
  );

  // Per-sensor operating baseline for an equipment (median ± stddev over a
  // trailing window) — drawn as the expected envelope behind live series.
  app.get(
    "/api/telemetry/baseline/:equipmentId",
    generalApiRateLimit,
    withErrorHandling("fetch telemetry baseline", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().min(1) }).parse(req.params);
      const { days } = z
        .object({ days: z.coerce.number().int().positive().max(365).default(30) })
        .parse(req.query);
      const baselines = await service.getBaseline(equipmentId, days);
      res.json({ equipmentId, days, baselines });
    })
  );

  // Per-equipment sensor-health rollup for SensorHealthDashboard.
  app.get(
    "/api/equipment/:equipmentId/sensor-health",
    generalApiRateLimit,
    withErrorHandling("fetch equipment sensor health", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().min(1) }).parse(req.params);
      const orgId = req.orgId!;
      const health = await service.getEquipmentSensorHealth(orgId, equipmentId);
      res.json(health);
    })
  );

  app.get(
    "/api/telemetry/history/:equipmentId/:sensorType",
    generalApiRateLimit,
    withErrorHandling("fetch telemetry history", async (req, res) => {
      const { equipmentId, sensorType } = telemetryHistoryParamSchema.parse(req.params);
      const { hours: h } = telemetryHistoryQuerySchema.parse(req.query);
      const history = await service.getHistory(equipmentId, sensorType, h ?? 24);
      res.json(history);
    })
  );

  app.delete(
    "/api/telemetry/cleanup",
    criticalOperationRateLimit,
    withErrorHandling("clear telemetry data", async (req, res) => {
      await service.clearOrphanedData();
      res.json({ ok: true, message: "Telemetry data cleared successfully" });
    })
  );

  // ========== EDGE HEARTBEAT ROUTES ==========

  app.get(
    "/api/edge/heartbeats",
    generalApiRateLimit,
    withErrorHandling("fetch heartbeats", async (req, res) => {
      const heartbeats = await service.getHeartbeats();
      res.json(heartbeats);
    })
  );

  // ========== SENSOR CONFIGURATION ROUTES ==========

  app.get(
    "/api/sensor-configs",
    generalApiRateLimit,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const configs = await service.getSensorConfigurations(req.orgId!, equipmentId, sensorType);
      res.json(configs);
    })
  );

  app.get(
    "/api/sensor-config",
    generalApiRateLimit,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const config = await service.getSensorConfiguration(req.orgId!, equipmentId, sensorType);
      if (!config) {
        return sendNotFound(res, "Sensor configuration");
      }
      res.json(config);
    })
  );

  logger.info(
    "TelemetryRoutes",
    "Telemetry read routes registered (readings: 4, heartbeats: 1, configs: 2)"
  );
}
