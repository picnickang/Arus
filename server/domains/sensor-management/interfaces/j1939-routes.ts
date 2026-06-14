/**
 * J1939 Configuration Routes - marine protocol configuration (via service).
 */

import type { Express } from "express";
import { insertJ1939ConfigurationSchema } from "@shared/schema-runtime";
import type { SensorRouteContext } from "./types.js";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";

export function registerJ1939Routes(app: Express, ctx: SensorRouteContext) {
  const { requireOrgId, writeOperationRateLimit, criticalOperationRateLimit, service } = ctx;

  app.get(
    "/api/j1939/configurations",
    requireOrgId,
    withErrorHandling("fetch J1939 configurations", async (req, res) => {
      const { deviceId } = req.query;
      const orgId = authenticatedRequest(req).orgId;
      res.json(await service.listJ1939Configurations(orgId, deviceId as string));
    })
  );

  app.get(
    "/api/j1939/configurations/:id",
    requireOrgId,
    withErrorHandling("fetch J1939 configuration", async (req, res) => {
      const { id = "" } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const configuration = await service.getJ1939Configuration(id, orgId);
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
      sendCreated(res, await service.createJ1939Configuration({ ...configData, orgId }));
    })
  );

  app.put(
    "/api/j1939/configurations/:id",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update J1939 configuration", async (req, res) => {
      const { id = "" } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const configData = insertJ1939ConfigurationSchema.partial().parse(req.body);
      const existing = await service.getJ1939Configuration(id, orgId);
      if (!existing) {
        return sendNotFound(res, "J1939 configuration");
      }
      res.json(await service.updateJ1939Configuration(id, configData, orgId));
    })
  );

  app.delete(
    "/api/j1939/configurations/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete J1939 configuration", async (req, res) => {
      const { id = "" } = req.params;
      const orgId = authenticatedRequest(req).orgId;
      const existing = await service.getJ1939Configuration(id, orgId);
      if (!existing) {
        return sendNotFound(res, "J1939 configuration");
      }
      await service.deleteJ1939Configuration(id, orgId);
      sendDeleted(res);
    })
  );
}
