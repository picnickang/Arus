import type { Express } from "express";
import { insertDeviceSchema } from "@shared/schema-runtime";
import { deviceService } from "./service";
import { safeDbOperation } from "../../error-handling";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../middleware/auth";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";

/**
 * Devices Routes
 * Handles HTTP concerns for devices domain
 */
export function registerDeviceRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // GET /api/devices
  app.get(
    "/api/devices",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch devices", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const devices = await (safeDbOperation as any)(
        () => deviceService.getDevicesWithStatus(orgId),
        "getDevicesWithStatus",
        { defaultValue: [] }
      );

      res.json(devices);
    })
  );

  // GET /api/devices/:id
  app.get(
    "/api/devices/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch device", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const device = await deviceService.getDeviceById(req.params.id, orgId);

      if (!device) {
        return sendNotFound(res, "Device");
      }

      res.json(device);
    })
  );

  // POST /api/devices
  app.post(
    "/api/devices",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create device", async (req, res) => {
      const deviceData = insertDeviceSchema.parse(req.body);
      const device = await deviceService.createDevice(deviceData, req.user?.id);

      sendCreated(res, device);
    })
  );

  // PUT /api/devices/:id
  app.put(
    "/api/devices/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update device", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const deviceData = insertDeviceSchema.partial().parse(req.body);
      const device = await deviceService.updateDevice(
        req.params.id,
        deviceData,
        orgId,
        req.user?.id
      );

      res.json(device);
    })
  );

  // DELETE /api/devices/:id
  app.delete(
    "/api/devices/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete device", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await deviceService.deleteDevice(req.params.id, orgId, req.user?.id);

      sendDeleted(res);
    })
  );
}
