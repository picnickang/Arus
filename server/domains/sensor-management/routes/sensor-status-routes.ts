/**
 * Sensor Status Routes
 * Endpoints for sensor status and state management
 */

import type { Express } from "express";
import { z } from "zod";
import { insertSensorStateSchema } from "@shared/schema-runtime";
import type { SensorManagementConfig } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated } from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { dbSensorsStorage } from "../../../db/sensors/index.js";

export function registerSensorStatusRoutes(app: Express, config: SensorManagementConfig) {
  const { requireOrgId } = config;

  app.get(
    "/api/sensor-configs/status",
    requireOrgId,
    withErrorHandling("fetch sensor status", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().optional() }).parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      const sensorConfigs = await dbSensorsStorage.getSensorConfigurations(orgId, equipmentId);
      const DEFAULT_THRESHOLD_MS = 5 * 60 * 1000;
      const now = new Date();
      const sensors = sensorConfigs.map((config) => ({
        equipmentId: config.equipmentId,
        sensorType: config.sensorType,
      }));
      const telemetrySource = dbSensorsStorage as object as {
        getLatestTelemetryForSensors?: (
          s: Array<{ equipmentId: string; sensorType: string }>,
          orgId: string
        ) => Promise<
          Array<{ equipmentId: string; sensorType: string; ts?: string | Date; value?: number }>
        >;
      };
      const telemetryResults = telemetrySource.getLatestTelemetryForSensors
        ? await telemetrySource.getLatestTelemetryForSensors(sensors, orgId)
        : [];
      const telemetryMap = new Map<string, { ts?: string | Date; value?: number }>(
        telemetryResults.map((result) => [`${result.equipmentId}:${result.sensorType}`, result])
      );

      const sensorStatus = sensorConfigs.map((config) => {
        const key = `${config.equipmentId}:${config.sensorType}`;
        const telemetry = telemetryMap.get(key);
        let status: "disabled" | "inactive" | "offline" | "online";
        if (!config.enabled) {
          status = "disabled";
        } else if (!telemetry || !telemetry.ts) {
          status = "inactive";
        } else {
          const thresholdMs = config.expectedIntervalMs
            ? config.expectedIntervalMs * (config.graceMultiplier || 2)
            : DEFAULT_THRESHOLD_MS;
          const elapsedMs = now.getTime() - new Date(telemetry.ts).getTime();
          status = elapsedMs < thresholdMs ? "online" : "offline";
        }
        return {
          id: config.id,
          equipmentId: config.equipmentId,
          sensorType: config.sensorType,
          status,
          lastTelemetry: telemetry?.ts || null,
          lastValue: telemetry?.value || null,
          enabled: config.enabled,
          expectedIntervalMs: config.expectedIntervalMs || null,
          graceMultiplier: config.graceMultiplier || null,
        };
      });
      res.json(sensorStatus);
    })
  );

  app.get(
    "/api/sensor-states/:equipmentId/:sensorType",
    requireOrgId,
    withErrorHandling("fetch sensor state", async (req, res) => {
      const { equipmentId = "", sensorType = "" } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const state = await dbSensorsStorage.getSensorState(equipmentId, sensorType, orgId);
      if (!state) {
        return sendNotFound(res, "Sensor state");
      }
      res.json(state);
    })
  );

  app.post(
    "/api/sensor-states",
    requireOrgId,
    withErrorHandling("create/update sensor state", async (req, res) => {
      const stateData = insertSensorStateSchema.parse(req.body);
      const orgId = authenticatedRequest(req).orgId;
      const sensorState = await dbSensorsStorage.upsertSensorState({ ...stateData, orgId });
      sendCreated(res, sensorState);
    })
  );
}
