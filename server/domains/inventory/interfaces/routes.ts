/**
 * Inventory Domain Routes — Interfaces Layer
 */

import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { inventoryService } from "../service";
import { inventorySupplierRouter } from "./supplier-routes";
import { supplierPerformanceRouter } from "./supplier-performance-routes";
import { replenishmentRouter } from "./replenishment-routes";
import { insertPartsInventorySchema } from "@shared/schema-runtime";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import { requirePermission } from "../../permissions/middleware";

const idParamSchema = z.object({ id: z.string().min(1) });
const partIdParamSchema = z.object({ partId: z.string().min(1) });

const availabilityBodySchema = z.object({
  partId: z.string().min(1),
  quantity: z.number().positive(),
});

const compatibilityBodySchema = z.object({
  equipmentIds: z.array(z.string().min(1)),
});

const partsInventoryQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  criticality: z.string().optional(),
  stockStatus: z.string().optional(),
  supplier: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

const createPartsInventoryBodySchema = z.object({
  orgId: z.string().optional(),
  partNumber: z.string().min(1),
  partName: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  unitCost: z.number().optional(),
  quantityOnHand: z.number().optional(),
  minStockLevel: z.number().optional(),
  maxStockLevel: z.number().optional(),
  location: z.string().optional(),
  supplierName: z.string().optional(),
  supplierPartNumber: z.string().optional(),
  leadTimeDays: z.number().optional(),
});

const updatePartsInventoryBodySchema = z
  .object({
    partNumber: z.string().optional(),
    partName: z.string().optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    unitCost: z.number().nullable().optional(),
    quantityOnHand: z.number().optional(),
    minStockLevel: z.number().nullable().optional(),
    maxStockLevel: z.number().nullable().optional(),
    location: z.string().nullable().optional(),
    supplierName: z.string().nullable().optional(),
    supplierPartNumber: z.string().nullable().optional(),
    leadTimeDays: z.number().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

const updateCostBodySchema = z.object({
  unitCost: z.number().nonnegative(),
  supplier: z.string().min(1),
});

const updateStockBodySchema = z
  .object({
    quantityOnHand: z.number().nonnegative().optional(),
    quantityReserved: z.number().nonnegative().optional(),
    minStockLevel: z.number().nonnegative().optional(),
    maxStockLevel: z.number().nonnegative().optional(),
  })
  .refine(
    (data) =>
      data.quantityOnHand !== undefined ||
      data.quantityReserved !== undefined ||
      data.minStockLevel !== undefined ||
      data.maxStockLevel !== undefined,
    { message: "At least one stock field must be provided" }
  );

export function registerInventoryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: RequestHandler;
    criticalOperationRateLimit: RequestHandler;
    generalApiRateLimit: RequestHandler;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/parts",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch parts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parts = await inventoryService.listParts(orgId);
      res.json(parts);
    })
  );

  app.delete(
    "/api/parts/:id",
    requireOrgId,
    requirePermission("inventory", "delete"),
    criticalOperationRateLimit,
    withErrorHandling("delete part", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      await inventoryService.deletePart(id, orgId, req.user?.id);
      sendDeleted(res);
    })
  );

  app.post(
    "/api/parts/availability",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("check part availability", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { partId, quantity } = availabilityBodySchema.parse(req.body);
      const availability = await inventoryService.checkAvailability(partId, quantity, orgId);
      res.json(availability);
    })
  );

  app.post(
    "/api/parts/:id/sync-costs",
    requireOrgId,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("sync part costs", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      await inventoryService.syncPartCosts(id, req.user?.id);
      res.json({ message: "Part costs synchronized successfully", partId: id });
    })
  );

  app.get(
    "/api/parts/:partId/compatible-equipment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch compatible equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { partId } = partIdParamSchema.parse(req.params);
      const equipment = await inventoryService.getCompatibleEquipment(partId, orgId);
      res.json(equipment);
    })
  );

  app.patch(
    "/api/parts/:partId/compatibility",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update part compatibility", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { partId } = partIdParamSchema.parse(req.params);
      const { equipmentIds } = compatibilityBodySchema.parse(req.body);
      const part = await inventoryService.updateCompatibility(
        partId,
        equipmentIds,
        orgId,
        req.user?.id
      );
      res.json(part);
    })
  );

  app.get(
    "/api/parts-inventory",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch parts inventory", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const query = partsInventoryQuerySchema.parse(req.query);
      const { limit, page } = query;
      const offset = (page - 1) * limit;

      const { items, total } = await inventoryService.listPartsInventoryPaginated(orgId, {
        limit,
        offset,
        search: query.search,
        category: query.category,
        criticality: query.criticality,
        stockStatus: query.stockStatus,
        supplier: query.supplier,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      const transformedParts = items.map((part) => {
        const quantityOnHand = part.quantityOnHand || 0;
        const quantityReserved = part.quantityReserved || 0;
        const availableQuantity = quantityOnHand - quantityReserved;
        const unitCost = part.unitCost || 0;

        return {
          id: part.id,
          partNumber: part.partNumber,
          partName: part.partName,
          description: part.description,
          category: part.category,
          unitOfMeasure: "ea",
          standardCost: unitCost,
          criticality: "medium",
          leadTimeDays: part.leadTimeDays || 7,
          minStockLevel: part.minStockLevel || 0,
          maxStockLevel: part.maxStockLevel || 100,
          supplierName: part.supplierName,
          supplierId: null,
          stock:
            part.quantityOnHand !== undefined
              ? {
                  id: `stock-${part.id}`,
                  quantityOnHand,
                  quantityReserved,
                  quantityOnOrder: 0,
                  availableQuantity,
                  unitCost,
                  location: part.location || "MAIN",
                  status: "unknown",
                }
              : null,
        };
      });

      res.json({
        items: transformedParts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    })
  );

  app.get(
    "/api/parts-inventory/low-stock-suggestions",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch low stock suggestions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const lowStockParts = await inventoryService.getLowStockParts(orgId);

      const suggestions = lowStockParts.map((part) => {
        const currentQty = part.quantityOnHand || 0;
        const minLevel = part.minStockLevel || 0;
        const maxLevel = part.maxStockLevel || minLevel * 3 || 10;
        const reorderQty = Math.max(1, maxLevel - currentQty);

        return {
          partId: part.id,
          partNumber: part.partNumber,
          partName: part.partName,
          category: part.category,
          criticality: "medium" as string,
          quantityOnHand: currentQty,
          minStockLevel: minLevel,
          maxStockLevel: maxLevel,
          suggestedOrderQty: reorderQty,
          supplierId: null as string | null,
          supplierName: part.supplierName,
          leadTimeDays: part.leadTimeDays || 7,
          estimatedCost: reorderQty * (part.unitCost || 0),
        };
      });

      const criticalityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      suggestions.sort((a, b) => {
        const critDiff =
          (criticalityOrder[a.criticality] ?? 4) - (criticalityOrder[b.criticality] ?? 4);
        if (critDiff !== 0) {
          return critDiff;
        }
        return a.quantityOnHand - a.minStockLevel - (b.quantityOnHand - b.minStockLevel);
      });

      res.json({
        total: suggestions.length,
        suggestions,
        estimatedTotalCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
      });
    })
  );

  app.post(
    "/api/parts-inventory",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "create"),
    writeOperationRateLimit,
    withErrorHandling("create parts inventory item", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const body = createPartsInventoryBodySchema.parse(req.body);

      const dbData = {
        orgId: body.orgId || orgId,
        partNumber: body.partNumber,
        partName: body.partName,
        description: body.description,
        category: body.category,
        manufacturer: body.manufacturer,
        unitCost: body.unitCost,
        quantityOnHand: body.quantityOnHand || 0,
        quantityReserved: 0,
        minStockLevel: body.minStockLevel,
        maxStockLevel: body.maxStockLevel,
        location: body.location,
        supplierName: body.supplierName,
        supplierPartNumber: body.supplierPartNumber,
        leadTimeDays: body.leadTimeDays || 7,
        isActive: true,
      };

      const validationResult = insertPartsInventorySchema.safeParse(dbData);
      if (!validationResult.success) {
        throw validationResult.error;
      }

      const item = await inventoryService.createInventoryItem(validationResult.data, req.user?.id);
      sendCreated(res, item);
    })
  );

  app.put(
    "/api/parts-inventory/:id",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update parts inventory item", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const body = updatePartsInventoryBodySchema.parse(req.body);

      const fields = [
        "partNumber",
        "partName",
        "description",
        "category",
        "manufacturer",
        "unitCost",
        "quantityOnHand",
        "minStockLevel",
        "maxStockLevel",
        "location",
        "supplierName",
        "supplierPartNumber",
        "leadTimeDays",
        "isActive",
      ] as const;
      const dbData: Record<string, unknown> = {};
      for (const f of fields) {
        const v = (body as Record<string, unknown>)[f];
        if (v !== undefined) {
          dbData[f] = v;
        }
      }

      const validationResult = insertPartsInventorySchema.partial().safeParse(dbData);
      if (!validationResult.success) {
        throw validationResult.error;
      }

      const orgId = (req as AuthenticatedRequest).orgId;
      const item = await inventoryService.updateInventoryItem(
        id,
        validationResult.data,
        req.user?.id,
        orgId
      );
      if (!item) {
        return sendNotFound(res, "Part");
      }
      res.json(item);
    })
  );

  app.patch(
    "/api/parts-inventory/:id/cost",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update part cost", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const { unitCost, supplier } = updateCostBodySchema.parse(req.body);
      const item = await inventoryService.updatePartCost(
        id,
        { unitCost, supplier },
        req.user?.id
      );
      if (!item) {
        return sendNotFound(res, "Part");
      }
      res.json(item);
    })
  );

  app.patch(
    "/api/parts-inventory/:id/stock",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update part stock", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const body = updateStockBodySchema.parse(req.body);
      const updateData: Record<string, number> = {};
      if (body.quantityOnHand !== undefined) {
        updateData['quantityOnHand'] = body.quantityOnHand;
      }
      if (body.quantityReserved !== undefined) {
        updateData['quantityReserved'] = body.quantityReserved;
      }
      if (body.minStockLevel !== undefined) {
        updateData['minStockLevel'] = body.minStockLevel;
      }
      if (body.maxStockLevel !== undefined) {
        updateData['maxStockLevel'] = body.maxStockLevel;
      }

      const item = await inventoryService.updatePartStock(id, updateData, req.user?.id);
      if (!item) {
        return sendNotFound(res, "Part");
      }
      res.json(item);
    })
  );

  app.use("/api", inventorySupplierRouter);
  app.use("/api", supplierPerformanceRouter);
  app.use("/api", replenishmentRouter);
}
