/**
 * Sensor Configuration Routes
 * CRUD operations for sensor configurations
 */

import type { Express } from "express";
import { insertSensorConfigSchema, bulkSensorConfigSchema } from "@shared/schema-runtime";
import type { SensorManagementConfig } from "./types.js";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { dbSensorsStorage } from "../../../db/sensors/index.js";
import { dbEquipmentStorage } from "../../../db/equipment/index.js";
import { z } from "zod";

const sensorConfigQuerySchema = z.object({
  equipmentId: z.string().optional(),
  sensorType: z.string().optional(),
});
const sensorPairParamSchema = z.object({
  equipmentId: z.string().min(1),
  sensorType: z.string().min(1),
});
const idParamSchema = z.object({ id: z.string().min(1) });

export function registerSensorConfigRoutes(app: Express, config: SensorManagementConfig) {
  const { requireOrgId, writeOperationRateLimit, criticalOperationRateLimit } = config;

  app.get(
    "/api/sensor-configs",
    requireOrgId,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      const configs = await dbSensorsStorage.getSensorConfigurations(
        orgId,
        equipmentId as string,
        sensorType as string
      );
      res.json(configs);
    })
  );

  app.get(
    "/api/sensor-config",
    requireOrgId,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = sensorConfigQuerySchema.parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      const configs = await dbSensorsStorage.getSensorConfigurations(
        orgId,
        equipmentId as string,
        sensorType as string
      );
      res.json(configs);
    })
  );

  app.get(
    "/api/sensor-configs/:equipmentId/:sensorType",
    requireOrgId,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorPairParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const sensorConfig = await dbSensorsStorage.getSensorConfiguration(
        equipmentId,
        sensorType,
        orgId
      );
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
      const sensorConfig = await dbSensorsStorage.createSensorConfiguration({
        ...configData,
        orgId,
      } as object as Parameters<typeof dbSensorsStorage.createSensorConfiguration>[0]);
      sendCreated(res, sensorConfig);
    })
  );

  app.post(
    "/api/sensor-config/bulk",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("bulk create sensor configurations", async (req, res) => {
      const payload = bulkSensorConfigSchema.parse(req.body);
      const { equipmentId, configs, overwriteExisting } = payload;
      const orgId = authenticatedRequest(req).orgId;
      const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
      if (!equipment) {
        return sendNotFound(res, "Equipment");
      }
      const fullConfigs = configs.map((config: Record<string, unknown>) => ({
        ...config,
        equipmentId,
        orgId,
      }));
      const created = await dbSensorsStorage.bulkCreateSensorConfigurations(
        fullConfigs as object as Parameters<typeof dbSensorsStorage.bulkCreateSensorConfigurations>[0],
        overwriteExisting
      );
      sendCreated(res, {
        message: `Successfully created ${created.length} sensor configuration(s)`,
        created: created.length,
        sensors: created,
      });
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
      const sensorConfig = await dbSensorsStorage.updateSensorConfiguration(
        equipmentId,
        sensorType,
        configData,
        orgId
      );
      res.json(sensorConfig);
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
      const sensorConfig = await dbSensorsStorage.updateSensorConfigurationById(
        id,
        configData,
        orgId
      );
      res.json(sensorConfig);
    })
  );

  app.delete(
    "/api/sensor-configs/:equipmentId/:sensorType",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = sensorPairParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      await dbSensorsStorage.deleteSensorConfiguration(equipmentId, sensorType, orgId);
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
      await dbSensorsStorage.deleteSensorConfigurationById(id, orgId);
      sendDeleted(res);
    })
  );
}
