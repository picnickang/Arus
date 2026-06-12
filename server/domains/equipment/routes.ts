import type { Express, Request, Response } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { LRUCache } from "lru-cache";
import { equipmentService } from "./service";
import { insertEquipmentSchema } from "@shared/schema-runtime";
import { db } from "../../db";
import {
  authenticatedRequest,
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../../middleware/auth";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import { requirePermission } from "../../lib/permissions/middleware.js";
import { enforceQuota } from "../../middleware/tenant-quota";
import { quotaService } from "../../tenancy/quota-service";
import { registerEquipmentLifecycleRoutes } from "./lifecycle-routes";

const equipmentCache = new LRUCache<string, object>({ max: 200, ttl: 30_000 });

function getCached<T>(key: string): T | null {
  const val = equipmentCache.get(key);
  return val !== undefined ? (val as T) : null;
}

function setCache(key: string, data: unknown): void {
  equipmentCache.set(key, data as never);
}

function invalidateCache(pattern: string): void {
  for (const key of equipmentCache.keys()) {
    if (key.startsWith(pattern)) {
      equipmentCache.delete(key);
    }
  }
}

const listEquipmentQuerySchema = z.object({
  paginated: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(1000).optional(),
  q: z.string().optional(),
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  vesselId: z.string().optional(),
  manufacturer: z.string().optional(),
});

const equipmentHealthQuerySchema = z.object({
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(1000).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const batchRulBodySchema = z.object({
  equipmentIds: z.array(z.string().min(1)).min(1),
});

const degradationBodySchema = z.object({
  componentType: z.string().min(1),
  degradationMetric: z.number(),
  vibrationLevel: z.number().optional(),
  temperature: z.number().optional(),
  oilCondition: z.string().optional(),
  acousticSignature: z.string().optional(),
  wearParticleCount: z.number().optional(),
  operatingHours: z.number().optional(),
  cycleCount: z.number().optional(),
  loadFactor: z.number().optional(),
});

/**
 * Register Equipment routes
 */
export function registerEquipmentRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: import("express").RequestHandler;
    criticalOperationRateLimit: import("express").RequestHandler;
    generalApiRateLimit: import("express").RequestHandler;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimiters;

  // GET all equipment (with optional pagination and filtering)
  app.get(
    "/api/equipment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch equipment registry", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const query = listEquipmentQuerySchema.parse(req.query);

      const paginatedParam = query.paginated === "true";
      const pageParam = query.page;
      const pageSizeParam = query.pageSize;
      const page = pageParam ?? 1;
      const pageSize = pageSizeParam ?? 20;
      const search = query.q ?? query.search;
      const type = query.type;
      const status = query.status;
      const vesselId = query.vesselId;
      const manufacturer = query.manufacturer;

      const hasFilters =
        search !== undefined ||
        type !== undefined ||
        status !== undefined ||
        vesselId !== undefined ||
        manufacturer !== undefined;

      const usePagination =
        paginatedParam || pageParam !== undefined || pageSizeParam !== undefined || hasFilters;

      if (usePagination) {
        const result = await equipmentService.listEquipmentPaginated(orgId, {
          page,
          pageSize,
          search,
          type,
          status,
          vesselId,
          manufacturer,
        });
        return res.json(result);
      }
      const cacheKey = `equipment:list:${orgId}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      const equipment = await equipmentService.listEquipment(orgId);
      setCache(cacheKey, equipment);
      return res.json(equipment);
    })
  );

  // GET equipment health - must come before /:id route to avoid routing conflicts
  app.get(
    "/api/equipment/health",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch equipment health", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const query = equipmentHealthQuerySchema.parse(req.query);
      let vesselId = query.vesselId;
      let equipmentId = query.equipmentId;

      if (vesselId && (vesselId === "[object Object]" || vesselId.startsWith("[object"))) {
        vesselId = undefined;
      }

      if (equipmentId && (equipmentId === "[object Object]" || equipmentId.startsWith("[object"))) {
        equipmentId = undefined;
      }

      const page = query.page;
      const pageSize = query.pageSize;

      const cacheKey = `equipment:health:${orgId}:${vesselId || "all"}:${equipmentId || "all"}:p${page ?? "all"}:s${pageSize ?? "all"}`;
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
        return res.json(response);
      }
      setCache(cacheKey, health);
      return res.json(health);
    })
  );

  // GET equipment with sensor issues
  app.get(
    "/api/equipment/sensor-issues",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch equipment with sensor issues", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const equipment = await equipmentService.getEquipmentWithSensorIssues(orgId);
      return res.json(equipment);
    })
  );

  // RUL Prediction - single equipment
  app.get(
    "/api/equipment/:id/rul",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("calculate RUL prediction", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id: equipmentId } = idParamSchema.parse(req.params);

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

      return res.json(prediction);
    })
  );

  // Batch RUL predictions
  app.post(
    "/api/equipment/rul/batch",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("calculate batch RUL predictions", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { equipmentIds } = batchRulBodySchema.parse(req.body);

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      const predictions = await rulEngine.calculateBatchRul(equipmentIds, orgId);
      const result = Object.fromEntries(predictions);

      return res.json(result);
    })
  );

  // Record component degradation
  app.post(
    "/api/equipment/:id/degradation",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("record degradation", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id: equipmentId } = idParamSchema.parse(req.params);
      const body = degradationBodySchema.parse(req.body);

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      await rulEngine.recordDegradation(orgId, equipmentId, body.componentType, {
        degradationMetric: body.degradationMetric,
        vibrationLevel: body.vibrationLevel,
        temperature: body.temperature,
        oilCondition: body.oilCondition,
        acousticSignature: body.acousticSignature,
        wearParticleCount: body.wearParticleCount,
        operatingHours: body.operatingHours,
        cycleCount: body.cycleCount,
        loadFactor: body.loadFactor,
      });

      return res.status(201).json({
        message: "Degradation recorded successfully",
        equipmentId,
        componentType: body.componentType,
      });
    })
  );

  // GET single equipment by ID
  app.get(
    "/api/equipment/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);

      const equipment = await equipmentService.getEquipmentById(id, orgId);
      if (!equipment) {
        sendNotFound(res, "Equipment");
        return;
      }

      return res.json(equipment);
    })
  );

  // POST create equipment
  app.post(
    "/api/equipment",
    requireOrgIdAndValidateBody,
    requirePermission("equipment", "create"),
    writeOperationRateLimit,
    enforceQuota("equipment_count"),
    withErrorHandling("create equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;

      const rawBody = jsonRecordSchema.parse(req.body);
      const validationResult = insertEquipmentSchema.safeParse({
        ...rawBody,
        orgId,
      });

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "create equipment");
        return;
      }

      const equipment = await equipmentService.createEquipment(validationResult.data);
      invalidateCache(`equipment:`);
      void quotaService.incrementUsage(orgId, "equipment_count", 1);
      return res.status(201).json(equipment);
    })
  );

  // PUT update equipment
  app.put(
    "/api/equipment/:id",
    requireOrgIdAndValidateBody,
    requirePermission("equipment", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);

      const rawBody = jsonRecordSchema.parse(req.body);
      const { orgId: _, id: __, createdAt: ___, updatedAt: ____, ...safeUpdateData } = rawBody;

      const validationResult = insertEquipmentSchema.partial().safeParse(safeUpdateData);
      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "update equipment");
        return;
      }

      try {
        const cleanedUpdate = Object.fromEntries(
          Object.entries(validationResult.data).filter(([, v]) => v !== undefined)
        ) as typeof validationResult.data;
        const equipment = await equipmentService.updateEquipment(id, cleanedUpdate, orgId);
        invalidateCache(`equipment:`);
        return res.json(equipment);
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
  app.delete(
    "/api/equipment/:id/disassociate-vessel",
    requireOrgId,
    requirePermission("equipment", "edit"),
    writeOperationRateLimit,
    withErrorHandling("disassociate equipment from vessel", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);

      try {
        await equipmentService.disassociateVessel(id, orgId);
        return res.json({ message: "Equipment successfully disassociated from vessel" });
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
  app.delete(
    "/api/equipment/:id",
    requireOrgId,
    requirePermission("equipment", "delete"),
    criticalOperationRateLimit,
    withErrorHandling("delete equipment", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);

      try {
        await equipmentService.deleteEquipment(id, orgId);
        invalidateCache(`equipment:`);
        return res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  registerEquipmentLifecycleRoutes(app, {
    criticalOperationRateLimit,
    generalApiRateLimit,
    invalidateCache,
  });
}
