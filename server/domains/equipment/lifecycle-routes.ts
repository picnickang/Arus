import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import {
  authenticatedRequest,
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../../middleware/auth";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import { requirePermission } from "../../lib/permissions/middleware.js";
import { equipmentService } from "./service";
import { equipmentLifecycleService } from "./application";
import { decommissionEquipmentSchema, reinstateEquipmentSchema } from "./domain";

const idParamSchema = z.object({ id: z.string().min(1) });
const equipmentIdParamSchema = z.object({ equipmentId: z.string().min(1) });
const decommissionedListQuerySchema = z.object({
  withHistory: z.string().optional(),
});

interface EquipmentLifecycleRouteContext {
  criticalOperationRateLimit: RequestHandler;
  generalApiRateLimit: RequestHandler;
  invalidateCache: (pattern: string) => void;
}

export function registerEquipmentLifecycleRoutes(
  app: Express,
  context: EquipmentLifecycleRouteContext
): void {
  const { criticalOperationRateLimit, generalApiRateLimit, invalidateCache } = context;

  // POST decommission equipment (using lifecycle service)
  app.post(
    "/api/equipment/:id/decommission",
    requireOrgIdAndValidateBody,
    requirePermission("equipment", "manage_config"),
    criticalOperationRateLimit,
    withErrorHandling("decommission equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id: equipmentId } = idParamSchema.parse(req.params);
      const userId = authenticatedRequest(req).userId;

      const validationResult = decommissionEquipmentSchema.safeParse(req.body);

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "decommission equipment");
        return;
      }

      try {
        const result = await equipmentLifecycleService.decommissionEquipment(
          equipmentId,
          orgId,
          validationResult.data,
          userId
        );
        invalidateCache(`equipment:`);
        return res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        if (error instanceof Error && error.message.includes("already decommissioned")) {
          res.status(409).json({ message: error.message });
          return;
        }
        throw error;
      }
    })
  );

  // POST reinstate equipment
  app.post(
    "/api/equipment/:id/reinstate",
    requireOrgIdAndValidateBody,
    requirePermission("equipment", "manage_config"),
    criticalOperationRateLimit,
    withErrorHandling("reinstate equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id: equipmentId } = idParamSchema.parse(req.params);
      const userId = authenticatedRequest(req).userId;

      const validationResult = reinstateEquipmentSchema.safeParse(req.body);

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "reinstate equipment");
        return;
      }

      try {
        const result = await equipmentLifecycleService.reinstateEquipment(
          equipmentId,
          orgId,
          validationResult.data,
          userId
        );
        invalidateCache(`equipment:`);
        return res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Decommissioned Equipment");
          return;
        }
        if (error instanceof Error && error.message.includes("already active")) {
          res.status(409).json({ message: error.message });
          return;
        }
        throw error;
      }
    })
  );

  // GET equipment lifecycle history
  app.get(
    "/api/equipment/:id/history",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch equipment history", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id: equipmentId } = idParamSchema.parse(req.params);

      try {
        const history = await equipmentLifecycleService.getEquipmentHistory(equipmentId, orgId);
        return res.json(history);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // GET decommissioned equipment list (using lifecycle service)
  app.get(
    "/api/equipment/decommissioned",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch decommissioned equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { withHistory: withHistoryParam } = decommissionedListQuerySchema.parse(req.query);
      const withHistory = withHistoryParam === "true";

      if (withHistory) {
        const decommissioned =
          await equipmentLifecycleService.getDecommissionedEquipmentWithHistory(orgId);
        return res.json(decommissioned);
      }
      const decommissioned = await equipmentLifecycleService.getDecommissionedEquipment(orgId);
      return res.json(decommissioned);
    })
  );

  // GET equipment sensor coverage
  app.get(
    "/api/equipment/:id/sensor-coverage",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("analyze equipment sensor coverage", async (req: Request, res: Response) => {
      const { id: equipmentId } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;

      const coverage = await equipmentService.getSensorCoverage(equipmentId, orgId);
      return res.json(coverage);
    })
  );

  // POST setup missing sensor configurations
  app.post(
    "/api/equipment/:id/setup-sensors",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling(
      "setup missing sensor configurations",
      async (req: Request, res: Response) => {
        const { id: equipmentId } = idParamSchema.parse(req.params);
        const orgId = authenticatedRequest(req).orgId;

        const result = await equipmentService.setupSensors(equipmentId, orgId);
        return res.json(result);
      }
    )
  );

  // GET compatible parts for equipment
  app.get(
    "/api/equipment/:equipmentId/compatible-parts",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch compatible parts", async (req: Request, res: Response) => {
      const { equipmentId } = equipmentIdParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;

      const parts = await equipmentService.getCompatibleParts(equipmentId, orgId);
      return res.json(parts);
    })
  );

  // GET suggested parts for equipment
  app.get(
    "/api/equipment/:equipmentId/suggested-parts",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch suggested parts", async (req: Request, res: Response) => {
      const { equipmentId } = equipmentIdParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;

      const parts = await equipmentService.getSuggestedParts(equipmentId, orgId);
      return res.json(parts);
    })
  );
}
