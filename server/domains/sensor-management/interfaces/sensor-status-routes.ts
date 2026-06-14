/**
 * Sensor Status Routes - sensor status rollup and state management (via service).
 */

import type { Express } from "express";
import { z } from "zod";
import { insertSensorStateSchema } from "@shared/schema-runtime";
import type { SensorRouteContext } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated } from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";

export function registerSensorStatusRoutes(app: Express, ctx: SensorRouteContext) {
  const { requireOrgId, service } = ctx;

  app.get(
    "/api/sensor-configs/status",
    requireOrgId,
    withErrorHandling("fetch sensor status", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().optional() }).parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      res.json(await service.getSensorStatus(orgId, equipmentId));
    })
  );

  app.get(
    "/api/sensor-states/:equipmentId/:sensorType",
    requireOrgId,
    withErrorHandling("fetch sensor state", async (req, res) => {
      const { equipmentId = "", sensorType = "" } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const state = await service.getSensorState(equipmentId, sensorType, orgId);
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
      sendCreated(res, await service.upsertSensorState({ ...stateData, orgId }));
    })
  );
}
