import type { Express } from "express";
import { z } from "zod";
import { dbTelemetryStorage, dbDevicesStorage, dbSensorsStorage } from "../../repositories";
import { getSensorBaselines } from "./infrastructure/telemetry-baseline.js";
import { listUnacknowledgedAlertNotifications } from "../../composition/telemetry-alerts.js";
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

  // Per-sensor operating baseline for an equipment: median ± stddev over a
  // trailing window, computed directly on equipment_telemetry (the rollup
  // table telemetry_aggregated is fed from raw_telemetry, not this table,
  // so it cannot back these stats; the partitioned table makes the direct
  // aggregate cheap). Used by MultiSensorChart to draw the expected
  // envelope behind live series — deviation from this band is the PdM
  // signal. Fleet-level baselines (/api/pdm/fleet/baselines) are a
  // different concept: per equipment *type*, from the feature store.
  app.get(
    "/api/telemetry/baseline/:equipmentId",
    generalApiRateLimit,
    withErrorHandling("fetch telemetry baseline", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().min(1) }).parse(req.params);
      const { days } = z
        .object({ days: z.coerce.number().int().positive().max(365).default(30) })
        .parse(req.query);

      const baselines = await getSensorBaselines(equipmentId, days);

      res.json({ equipmentId, days, baselines });
    })
  );

  // Per-equipment sensor-health rollup for SensorHealthDashboard (the PdM
  // equipment page). The component shipped against this contract but no
  // route ever existed. Status comes from each sensor's newest reading in
  // a 24h window; sensors are the configured set when configurations
  // exist, otherwise the sensor types observed in the window (so
  // unconfigured-but-reporting equipment isn't rendered as sensor-less).
  app.get(
    "/api/equipment/:equipmentId/sensor-health",
    generalApiRateLimit,
    withErrorHandling("fetch equipment sensor health", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().min(1) }).parse(req.params);
      const orgId = req.orgId!;

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [configs, readings, openAlerts] = await Promise.all([
        dbSensorsStorage.getSensorConfigurations(orgId, equipmentId),
        dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId, since, new Date()),
        listUnacknowledgedAlertNotifications(orgId),
      ]);

      // Newest reading + sample count per sensor type. Rows arrive in
      // ASCENDING ts order (getTelemetryByEquipmentAndDateRange), so the
      // last row seen per sensor is the newest — overwrite as we go.
      const bySensor = new Map<string, { status: string; count: number }>();
      for (const reading of readings) {
        const entry = bySensor.get(reading.sensorType);
        if (entry) {
          entry.count++;
          entry.status = reading.status ?? "normal";
        } else {
          bySensor.set(reading.sensorType, { status: reading.status ?? "normal", count: 1 });
        }
      }

      const sensorTypes =
        configs.length > 0
          ? configs.map((c) => ({ type: c.sensorType, enabled: c.enabled !== false }))
          : Array.from(bySensor.keys()).map((type) => ({ type, enabled: true }));

      let normalSensors = 0;
      let warningSensors = 0;
      let criticalSensors = 0;
      let offlineSensors = 0;
      let consistentSensors = 0;
      for (const sensor of sensorTypes) {
        const latest = bySensor.get(sensor.type);
        if (!sensor.enabled || !latest) {
          offlineSensors++;
          continue;
        }
        if (latest.count >= 10) {
          consistentSensors++;
        }
        if (latest.status === "critical") {
          criticalSensors++;
        } else if (latest.status === "warning") {
          warningSensors++;
        } else {
          normalSensors++;
        }
      }

      const totalSensors = sensorTypes.length;
      const activeSensors = totalSensors - offlineSensors;
      const recentAnomalies = openAlerts.filter(
        (a) => a.equipmentId === equipmentId && a.createdAt && new Date(a.createdAt) >= since
      ).length;
      const pct = (n: number) => (totalSensors === 0 ? 0 : Math.round((n / totalSensors) * 100));

      res.json({
        totalSensors,
        activeSensors,
        normalSensors,
        warningSensors,
        criticalSensors,
        offlineSensors,
        // Weighted: normal=100, warning=60, critical=20, offline=0.
        overallHealthScore:
          totalSensors === 0
            ? 0
            : Math.round(
                (normalSensors * 100 + warningSensors * 60 + criticalSensors * 20) / totalSensors
              ),
        // Share of sensors reporting consistently (>=10 samples in 24h).
        dataQualityScore: pct(consistentSensors),
        recentAnomalies,
        uptimePercentage: pct(activeSensors),
      });
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
      // NOTE: getTelemetryHistory's 3rd parameter is a row LIMIT, not
      // hours — the old call turned "?hours=24" into "the 24 most recent
      // rows". Use the date-range query so the window is actually a
      // time window.
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const history = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
        equipmentId,
        since,
        new Date(),
        sensorType
      );
      // Charts can't usefully render more than ~1k points per series, and
      // high-rate sensors produce tens of thousands per day — stride-
      // decimate evenly across the window (always keeping the newest
      // reading) so the payload and render cost stay bounded.
      const MAX_POINTS = 1000;
      if (history.length > MAX_POINTS) {
        const stride = Math.ceil(history.length / MAX_POINTS);
        const decimated = history.filter((_, i) => i % stride === 0);
        // Rows are in ASCENDING ts order — the newest reading is the LAST
        // element; always retain it so charts show the latest value.
        const newest = history[history.length - 1];
        if (newest && decimated[decimated.length - 1] !== newest) {
          decimated.push(newest);
        }
        res.json(decimated);
        return;
      }
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
