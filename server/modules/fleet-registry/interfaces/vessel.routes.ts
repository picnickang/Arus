import type { Express, RequestHandler, Request } from "express";
import type { FleetRegistryService } from "../application/fleet-registry.service";
import { insertVesselSchema } from "@shared/schema-runtime";
import { requireAdminAuth, auditAdminAction } from "../../../security";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import {
  withErrorHandling,
  handleApiError,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import { requirePermission } from "../../../domains/permissions/middleware";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

function getOrgIdFromRequest(req: Request & { orgId?: string }): string {
  return req.orgId || DEFAULT_ORG_ID;
}

function requireParam(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`Missing required route param: ${name}`);
  }
  return v;
}

export interface RateLimiters {
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export function registerFleetRegistryVesselRoutes(
  app: Express,
  service: FleetRegistryService,
  rateLimiters: RateLimiters
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimiters;

  app.get(
    "/api/vessels",
    generalApiRateLimit,
    withErrorHandling("fetch vessels", async (req, res) => {
      const { org_id } = req.query;
      const vessels = await service.listVessels(org_id as string | undefined);
      res.json(vessels);
    })
  );

  app.post(
    "/api/vessels",
    requireOrgIdAndValidateBody,
    requirePermission("vessels", "create"),
    writeOperationRateLimit,
    withErrorHandling("create vessel", async (req, res) => {
      const validationResult = insertVesselSchema.safeParse({
        ...req.body,
        orgId: getOrgIdFromRequest(req),
      });

      if (!validationResult.success) {
        return handleApiError(res, validationResult.error, "create vessel");
      }

      const vessel = await service.createVessel(validationResult.data);
      sendCreated(res, vessel);
    })
  );

  app.get(
    "/api/vessels/:id",
    generalApiRateLimit,
    withErrorHandling("fetch vessel", async (req, res) => {
      const vessel = await service.getVesselById(requireParam(req, 'id'));
      if (!vessel) {
        return sendNotFound(res, "Vessel");
      }
      res.json(vessel);
    })
  );

  app.put(
    "/api/vessels/:id",
    requireOrgIdAndValidateBody,
    requirePermission("vessels", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update vessel", async (req, res) => {
      const validationResult = insertVesselSchema.partial().safeParse(req.body);

      if (!validationResult.success) {
        return handleApiError(res, validationResult.error, "update vessel");
      }

      const vessel = await service.updateVessel(requireParam(req, 'id'), validationResult.data);
      if (!vessel) {
        return sendNotFound(res, "Vessel");
      }
      res.json(vessel);
    })
  );

  app.delete(
    "/api/vessels/:id",
    ...requireAdminAuth,
    requirePermission("vessels", "delete"),
    auditAdminAction("delete_vessel"),
    criticalOperationRateLimit,
    withErrorHandling("delete vessel", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      await service.deleteVessel(requireParam(req, 'id'), true, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/vessels/:id/export",
    ...requireAdminAuth,
    auditAdminAction("export_vessel"),
    criticalOperationRateLimit,
    withErrorHandling("export vessel", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const exportData = await service.exportVessel(requireParam(req, 'id'), orgId);

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="vessel-${requireParam(req, 'id')}-export.json"`
      );
      res.json(exportData);
    })
  );

  app.post(
    "/api/vessels/import",
    ...requireAdminAuth,
    auditAdminAction("import_vessel"),
    criticalOperationRateLimit,
    withErrorHandling("import vessel", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const result = await service.importVessel(req.body, orgId);
      sendCreated(res, result);
    })
  );

  app.post(
    "/api/vessels/:id/reset-downtime",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("reset vessel downtime", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const result = await service.resetDowntime(requireParam(req, 'id'), orgId);
      res.json(result);
    })
  );

  app.post(
    "/api/vessels/:id/reset-operation",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("reset vessel operation", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const result = await service.resetOperation(requireParam(req, 'id'), orgId);
      res.json(result);
    })
  );

  app.post(
    "/api/vessels/:id/wipe-data",
    ...requireAdminAuth,
    auditAdminAction("wipe_vessel_data"),
    criticalOperationRateLimit,
    withErrorHandling("wipe vessel data", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const result = await service.wipeData(requireParam(req, 'id'), orgId);
      res.json(result);
    })
  );

  app.get(
    "/api/vessels/:id/equipment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch vessel equipment", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const equipment = await service.getVesselEquipment(requireParam(req, 'id'), orgId);
      res.json(equipment);
    })
  );

  app.post(
    "/api/vessels/:vesselId/equipment/:equipmentId",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("assign equipment to vessel", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const vesselId = requireParam(req, 'vesselId');
      const equipmentId = requireParam(req, 'equipmentId');
      const result = await service.assignEquipment(vesselId, equipmentId, orgId);
      res.json(result);
    })
  );

  app.delete(
    "/api/vessels/:vesselId/equipment/:equipmentId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("unassign equipment from vessel", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const vesselId = requireParam(req, 'vesselId');
      const equipmentId = requireParam(req, 'equipmentId');
      await service.unassignEquipment(vesselId, equipmentId, orgId);
      res.json({ success: true });
    })
  );
}
