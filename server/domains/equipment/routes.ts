import type { Express, Request, Response } from "express";
import { LRUCache } from "lru-cache";
import { equipmentService } from "./service";
import { insertEquipmentSchema, insertDecommissionEventSchema } from "@shared/schema-runtime";
import { db } from "../../db";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../middleware/auth";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import {
  equipmentLifecycleService,
  decommissionEquipmentSchema,
  reinstateEquipmentSchema,
} from "./lifecycle";
import { requirePermission } from "../permissions/middleware";

const equipmentCache = new LRUCache<string, unknown>({ max: 200, ttl: 30_000 });

function getCached<T>(key: string): T | null {
  const val = equipmentCache.get(key);
  return val !== undefined ? (val as T) : null;
}

function setCache(key: string, data: unknown): void {
  equipmentCache.set(key, data);
}

function invalidateCache(pattern: string): void {
  for (const key of equipmentCache.keys()) {
    if (key.startsWith(pattern)) equipmentCache.delete(key);
  }
}

/**
 * Register Equipment routes
 */
export function registerEquipmentRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimiters;

  // GET all equipment (with optional pagination and filtering)
  app.get("/api/equipment", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment registry", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const paginatedParam = req.query.paginated === "true";
      const pageParam = req.query.page;
      const pageSizeParam = req.query.pageSize;
      const page = pageParam ? Number.parseInt(pageParam as string, 10) : 1;
      const pageSize = pageSizeParam ? Number.parseInt(pageSizeParam as string, 10) : 20;
      const search = req.query.q || req.query.search;
      const type = req.query.type;
      const status = req.query.status;
      const vesselId = req.query.vesselId;
      const manufacturer = req.query.manufacturer;

      const hasFilters =
        search !== undefined ||
        type !== undefined ||
        status !== undefined ||
        vesselId !== undefined ||
        manufacturer !== undefined;

      const usePagination =
        paginatedParam || pageParam !== undefined || pageSizeParam !== undefined || hasFilters;

      if (usePagination) {
        if (Number.isNaN(page) || page < 1) {
          res.status(400).json({ message: "Invalid page number" });
          return;
        }

        if (Number.isNaN(pageSize) || pageSize < 1 || pageSize > 1000) {
          res.status(400).json({ message: "Invalid page size (must be 1-1000)" });
          return;
        }

        const result = await equipmentService.listEquipmentPaginated(orgId, {
          page,
          pageSize,
          search: search as string,
          type: type as string,
          status: status as "active" | "inactive",
          vesselId: vesselId as string,
          manufacturer: manufacturer as string,
        });
        res.json(result);
      } else {
        // Use cache for non-paginated full list
        const cacheKey = `equipment:list:${orgId}`;
        const cached = getCached(cacheKey);
        if (cached) {
          return res.json(cached);
        }
        const equipment = await equipmentService.listEquipment(orgId);
        setCache(cacheKey, equipment);
        res.json(equipment);
      }
    })
  );

  // GET equipment health - must come before /:id route to avoid routing conflicts
  app.get("/api/equipment/health", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment health", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      let vesselId = req.query.vesselId as string | undefined;
      let equipmentId = req.query.equipmentId as string | undefined;

      if (vesselId && (vesselId === "[object Object]" || vesselId.startsWith("[object"))) {
        vesselId = undefined;
      }

      if (equipmentId && (equipmentId === "[object Object]" || equipmentId.startsWith("[object"))) {
        equipmentId = undefined;
      }

      const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : undefined;
      const pageSize = req.query.pageSize ? Number.parseInt(req.query.pageSize as string, 10) : undefined;

      const cacheKey = `equipment:health:${orgId}:${vesselId || 'all'}:${equipmentId || 'all'}:p${page ?? 'all'}:s${pageSize ?? 'all'}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      let health = await equipmentService.getEquipmentHealth(orgId, vesselId, equipmentId);

      const totalCount = health.length;
      if (page !== undefined && pageSize !== undefined) {
        const start = (page - 1) * pageSize;
        health = health.slice(start, start + pageSize);
        const response = {
          data: health,
          pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
          },
        };
        setCache(cacheKey, response);
        res.json(response);
      } else {
        setCache(cacheKey, health);
        res.json(health);
      }
    })
  );

  // GET equipment with sensor issues
  app.get("/api/equipment/sensor-issues", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment with sensor issues", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipment = await equipmentService.getEquipmentWithSensorIssues(orgId);
      res.json(equipment);
    })
  );

  // RUL Prediction - single equipment
  app.get("/api/equipment/:id/rul", requireOrgId, generalApiRateLimit,
    withErrorHandling("calculate RUL prediction", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      const prediction = await rulEngine.calculateRul(equipmentId, orgId);

      if (!prediction) {
        res.status(404).json({
          message: "No RUL prediction available for this equipment",
          hint: "Ensure equipment has degradation data or ML predictions",
        });
        return;
      }

      res.json(prediction);
    })
  );

  // Batch RUL predictions
  app.post("/api/equipment/rul/batch", requireOrgId, generalApiRateLimit,
    withErrorHandling("calculate batch RUL predictions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentIds } = req.body;

      if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
        res.status(400).json({ message: "equipmentIds array is required" });
        return;
      }

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      const predictions = await rulEngine.calculateBatchRul(equipmentIds, orgId);
      const result = Object.fromEntries(predictions);

      res.json(result);
    })
  );

  // Record component degradation
  app.post("/api/equipment/:id/degradation", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("record degradation", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;

      const {
        componentType,
        degradationMetric,
        vibrationLevel,
        temperature,
        oilCondition,
        acousticSignature,
        wearParticleCount,
        operatingHours,
        cycleCount,
        loadFactor,
      } = req.body;

      if (!componentType || degradationMetric === undefined) {
        res.status(400).json({
          message: "componentType and degradationMetric are required",
        });
        return;
      }

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      await rulEngine.recordDegradation(orgId, equipmentId, componentType, {
        degradationMetric,
        vibrationLevel,
        temperature,
        oilCondition,
        acousticSignature,
        wearParticleCount,
        operatingHours,
        cycleCount,
        loadFactor,
      });

      res.status(201).json({
        message: "Degradation recorded successfully",
        equipmentId,
        componentType,
      });
    })
  );

  // GET single equipment by ID
  app.get("/api/equipment/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const equipment = await equipmentService.getEquipmentById(req.params.id, orgId);
      if (!equipment) {
        sendNotFound(res, "Equipment");
        return;
      }

      res.json(equipment);
    })
  );

  // POST create equipment
  app.post("/api/equipment", requireOrgIdAndValidateBody, requirePermission("equipment", "create"), writeOperationRateLimit,
    withErrorHandling("create equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const validationResult = insertEquipmentSchema.safeParse({
        ...req.body,
        orgId,
      });

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "create equipment");
        return;
      }

      const equipment = await equipmentService.createEquipment(validationResult.data);
      invalidateCache(`equipment:`);
      res.status(201).json(equipment);
    })
  );

  // PUT update equipment
  app.put("/api/equipment/:id", requireOrgIdAndValidateBody, requirePermission("equipment", "edit"), writeOperationRateLimit,
    withErrorHandling("update equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { orgId: _, id: __, createdAt: ___, updatedAt: ____, ...safeUpdateData } = req.body;

      const validationResult = insertEquipmentSchema.partial().safeParse(safeUpdateData);
      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "update equipment");
        return;
      }

      try {
        const equipment = await equipmentService.updateEquipment(
          req.params.id,
          validationResult.data,
          orgId
        );
        invalidateCache(`equipment:`);
        res.json(equipment);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // DELETE disassociate equipment from vessel
  app.delete("/api/equipment/:id/disassociate-vessel", requireOrgId, requirePermission("equipment", "edit"), writeOperationRateLimit,
    withErrorHandling("disassociate equipment from vessel", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      try {
        await equipmentService.disassociateVessel(req.params.id, orgId);
        res.json({ message: "Equipment successfully disassociated from vessel" });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // DELETE equipment
  app.delete("/api/equipment/:id", requireOrgId, requirePermission("equipment", "delete"), criticalOperationRateLimit,
    withErrorHandling("delete equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      try {
        await equipmentService.deleteEquipment(req.params.id, orgId);
        invalidateCache(`equipment:`);
        res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // POST decommission equipment (using lifecycle service)
  app.post("/api/equipment/:id/decommission", requireOrgIdAndValidateBody, requirePermission("equipment", "manage_config"), criticalOperationRateLimit,
    withErrorHandling("decommission equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;
      const userId = (req as AuthenticatedRequest).userId;

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
        res.json(result);
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
  app.post("/api/equipment/:id/reinstate", requireOrgIdAndValidateBody, requirePermission("equipment", "manage_config"), criticalOperationRateLimit,
    withErrorHandling("reinstate equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;
      const userId = (req as AuthenticatedRequest).userId;

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
        res.json(result);
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
  app.get("/api/equipment/:id/history", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment history", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;

      try {
        const history = await equipmentLifecycleService.getEquipmentHistory(equipmentId, orgId);
        res.json(history);
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
  app.get("/api/equipment/decommissioned", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch decommissioned equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const withHistory = req.query.withHistory === "true";

      if (withHistory) {
        const decommissioned = await equipmentLifecycleService.getDecommissionedEquipmentWithHistory(orgId);
        res.json(decommissioned);
      } else {
        const decommissioned = await equipmentLifecycleService.getDecommissionedEquipment(orgId);
        res.json(decommissioned);
      }
    })
  );

  // GET equipment sensor coverage
  app.get("/api/equipment/:id/sensor-coverage", requireOrgId, generalApiRateLimit,
    withErrorHandling("analyze equipment sensor coverage", async (req: Request, res: Response) => {
      const equipmentId = req.params.id;
      const orgId = (req as AuthenticatedRequest).orgId;

      const coverage = await equipmentService.getSensorCoverage(equipmentId, orgId);
      res.json(coverage);
    })
  );

  // POST setup missing sensor configurations
  app.post("/api/equipment/:id/setup-sensors", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("setup missing sensor configurations", async (req: Request, res: Response) => {
      const equipmentId = req.params.id;
      const orgId = (req as AuthenticatedRequest).orgId;

      const result = await equipmentService.setupSensors(equipmentId, orgId);
      res.json(result);
    })
  );

  // GET compatible parts for equipment
  app.get("/api/equipment/:equipmentId/compatible-parts", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch compatible parts", async (req: Request, res: Response) => {
      const equipmentId = req.params.equipmentId;
      const orgId = (req as AuthenticatedRequest).orgId;

      const parts = await equipmentService.getCompatibleParts(equipmentId, orgId);
      res.json(parts);
    })
  );

  // GET suggested parts for equipment
  app.get("/api/equipment/:equipmentId/suggested-parts", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch suggested parts", async (req: Request, res: Response) => {
      const equipmentId = req.params.equipmentId;
      const orgId = (req as AuthenticatedRequest).orgId;

      const parts = await equipmentService.getSuggestedParts(equipmentId, orgId);
      res.json(parts);
    })
  );
}
