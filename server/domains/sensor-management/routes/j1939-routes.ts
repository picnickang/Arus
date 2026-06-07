/**
 * J1939 Configuration Routes
 * Marine protocol configuration management
 */

import type { Express } from "express";
import { insertJ1939ConfigurationSchema } from "@shared/schema-runtime";
import type { SensorManagementConfig } from "./types.js";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { dbSensorsStorage } from "../../../db/sensors/index.js";

export function registerJ1939Routes(app: Express, config: SensorManagementConfig) {
  const { requireOrgId, writeOperationRateLimit, criticalOperationRateLimit } = config;

  app.get(
    "/api/j1939/configurations",
    requireOrgId,
    withErrorHandling("fetch J1939 configurations", async (req, res) => {
      const { deviceId } = req.query;
      const orgId = authenticatedRequest(req).orgId;
      const configurations = await dbSensorsStorage.getJ1939Configurations(
        orgId,
        deviceId as string
      );
      res.json(configurations);
    })
  );

  app.get(
    "/api/j1939/configurations/:id",
    requireOrgId,
    withErrorHandling("fetch J1939 configuration", async (req, res) => {
      const { id = '' } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const configuration = await dbSensorsStorage.getJ1939Configuration(id, orgId);
      if (!configuration) {
        return sendNotFound(res, "J1939 configuration");
      }
      res.json(configuration);
    })
  );

  app.post(
    "/api/j1939/configurations",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("create J1939 configuration", async (req, res) => {
      const configData = insertJ1939ConfigurationSchema.parse(req.body);
      const orgId = authenticatedRequest(req).orgId;
      const configuration = await dbSensorsStorage.createJ1939Configuration({
        ...configData,
        orgId,
      });
      sendCreated(res, configuration);
    })
  );

  app.put(
    "/api/j1939/configurations/:id",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update J1939 configuration", async (req, res) => {
      const { id = '' } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const configData = insertJ1939ConfigurationSchema.partial().parse(req.body);
      const existing = await dbSensorsStorage.getJ1939Configuration(id, orgId);
      if (!existing) {
        return sendNotFound(res, "J1939 configuration");
      }
      const configuration = await dbSensorsStorage.updateJ1939Configuration(id, configData, orgId);
      res.json(configuration);
    })
  );

  app.delete(
    "/api/j1939/configurations/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete J1939 configuration", async (req, res) => {
      const { id = '' } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const existing = await dbSensorsStorage.getJ1939Configuration(id, orgId);
      if (!existing) {
        return sendNotFound(res, "J1939 configuration");
      }
      await dbSensorsStorage.deleteJ1939Configuration(id, orgId);
      sendDeleted(res);
    })
  );
}
