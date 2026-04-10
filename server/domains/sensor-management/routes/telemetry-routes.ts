/**
 * Telemetry Routes
 * Telemetry history and data endpoints
 */

import type { Express } from "express";
import type { SensorManagementConfig } from "./types.js";
import { dbTelemetryStorage } from "../../../db/telemetry/index.js";

export function registerTelemetryRoutes(app: Express, config: SensorManagementConfig) {
  const { requireOrgId } = config;

  app.get("/api/telemetry/history/:equipmentId/:sensorType", requireOrgId, async (req, res) => {
    try {
      const { equipmentId, sensorType } = req.params;
      const hours = req.query.hours ? Number.parseInt(req.query.hours as string) : 24;
      const history = await dbTelemetryStorage.getTelemetryHistory(equipmentId, sensorType, hours);
      res.json(history);
    } catch (_error) {
      res.status(500).json({ message: "Failed to fetch telemetry history" });
    }
  });
}
