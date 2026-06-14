/**
 * Sensor Configuration Routes - CRUD over sensor configurations (via service).
 */

import type { Express } from "express";
import { z } from "zod";
import { insertSensorConfigSchema, bulkSensorConfigSchema } from "@shared/schema-runtime";
import type { SensorRouteContext } from "./types.js";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { EquipmentNotFoundError } from "../application";

const sensorConfigQuerySchema = z.object({
  equipmentId: z.string().optional(),
  sensorType: z.string().optional(),
});
const sensorPairParamSchema = z.object({
  equipmentId: z.string().min(1),
  sensorType: z.string().min(1),
});
const idParamSchema = z.object({ id: z.string().min(1) });

export function registerSensorConfigRoutes(app: Express, ctx: SensorRouteContext) {
  const { requireOrgId, writeOperationRateLimit, criticalOperationRateLimit, service } = ctx;

  app.get(
    "/api/sensor-configs",
    requireOrgId,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      res.json(await service.listSensorConfigurations(orgId, equipmentId, sensorType));
    })
  );

  app.get(
    "/api/sensor-config",
    requireOrgId,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      res.json(await service.listSensorConfigurations(orgId, equipmentId, sensorType));
    })
  );

  app.get(
    "/api/sensor-configs/:equipmentId/:sensorType",
    requireOrgId,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorPairParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const sensorConfig = await service.getSensorConfiguration(equipmentId, sensorType, orgId);
      if (!sensorConfig) {
        return sendNotFound(res, "Sensor configuration");
      }
      res.json(sensorConfig);
    })
  );

  app.post(
    "/api/sensor-configs",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create sensor configuration", async (req, res) => {
      const configData = insertSensorConfigSchema.parse(req.body);
      const orgId = authenticatedRequest(req).orgId;
      sendCreated(res, await service.createSensorConfiguration(orgId, configData));
    })
  );

  app.post(
    "/api/sensor-config/bulk",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("bulk create sensor configurations", async (req, res) => {
      const { equipmentId, configs, overwriteExisting } = bulkSensorConfigSchema.parse(req.body);
      const orgId = authenticatedRequest(req).orgId;
      try {
        const created = await service.bulkCreateSensorConfigurations(
          orgId,
          equipmentId,
          configs,
          overwriteExisting
        );
        sendCreated(res, {
          message: `Successfully created ${created.length} sensor configuration(s)`,
          created: created.length,
          sensors: created,
        });
      } catch (err) {
        if (err instanceof EquipmentNotFoundError) {
          return sendNotFound(res, "Equipment");
        }
        throw err;
      }
    })
  );

  app.put(
    "/api/sensor-configs/:equipmentId/:sensorType",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorPairParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const configData = insertSensorConfigSchema.partial().parse(req.body);
      res.json(
        await service.updateSensorConfiguration(equipmentId, sensorType, configData, orgId)
      );
    })
  );

  app.put(
    "/api/sensor-configs/:id",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update sensor configuration", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const configData = insertSensorConfigSchema.partial().parse(req.body);
      res.json(await service.updateSensorConfigurationById(id, configData, orgId));
    })
  );

  app.delete(
    "/api/sensor-configs/:equipmentId/:sensorType",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorPairParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      await service.deleteSensorConfiguration(equipmentId, sensorType, orgId);
      sendDeleted(res);
    })
  );

  app.delete(
    "/api/sensor-configs/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete sensor configuration", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      await service.deleteSensorConfigurationById(id, orgId);
      sendDeleted(res);
    })
  );
}
