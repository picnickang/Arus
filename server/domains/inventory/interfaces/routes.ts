import type { Express, Request, Response } from "express";
import { inventoryService } from "../service";
import { inventorySupplierRouter } from "./supplier-routes";
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

/**
 * Inventory (Parts) Routes - Interfaces Layer
 * Handles HTTP concerns for inventory domain (parts catalog and inventory)
 */
export function registerInventoryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== Parts (Enhanced Catalog) Endpoints ==========

  // GET /api/parts - List all parts
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

  // DELETE /api/parts/:id - Delete part
  app.delete(
    "/api/parts/:id",
    requireOrgId,
    requirePermission("inventory", "delete"),
    criticalOperationRateLimit,
    withErrorHandling("delete part", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await inventoryService.deletePart(req.params.id, orgId, req.user?.id);
      sendDeleted(res);
    })
  );

  // POST /api/parts/availability - Check part availability
  app.post(
    "/api/parts/availability",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("check part availability", async (req: Request, res: Response) => {
      const { partId, quantity } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!partId || !quantity) {
        return res.status(400).json({
          message: "partId and quantity are required",
        });
      }

      const availability = await inventoryService.checkAvailability(partId, quantity, orgId);
      res.json(availability);
    })
  );

  // POST /api/parts/:id/sync-costs - Sync part costs to stock
  app.post(
    "/api/parts/:id/sync-costs",
    requireOrgId,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("sync part costs", async (req: Request, res: Response) => {
      await inventoryService.syncPartCosts(req.params.id, req.user?.id);
      res.json({
        message: "Part costs synchronized successfully",
        partId: req.params.id,
      });
    })
  );

  // GET /api/parts/:partId/compatible-equipment - Get compatible equipment for part
  app.get(
    "/api/parts/:partId/compatible-equipment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch compatible equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipment = await inventoryService.getCompatibleEquipment(req.params.partId, orgId);
      res.json(equipment);
    })
  );

  // PATCH /api/parts/:partId/compatibility - Update part compatibility
  app.patch(
    "/api/parts/:partId/compatibility",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update part compatibility", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentIds } = req.body;

      if (!Array.isArray(equipmentIds)) {
        return res.status(400).json({
          message: "equipmentIds must be an array",
        });
      }

      const part = await inventoryService.updateCompatibility(
        req.params.partId,
        equipmentIds,
        orgId,
        req.user?.id
      );
      res.json(part);
    })
  );

  // ========== Parts Inventory (CMMS-lite) Endpoints ==========

  // GET /api/parts-inventory - List all parts inventory
  app.get(
    "/api/parts-inventory",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch parts inventory", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { category, search, sortBy, sortOrder } = req.query;

      const inventory = await inventoryService.listPartsInventory(
        category as string | undefined,
        orgId,
        search as string | undefined,
        sortBy as string | undefined,
        sortOrder as "asc" | "desc" | undefined
      );

      // Transform the flat response to match frontend expectations (nested stock object)
      const transformedParts = inventory.map((part: any) => {
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
          unitOfMeasure: part.unitOfMeasure || "ea",
          standardCost: unitCost,
          criticality: part.criticality || "medium",
          leadTimeDays: part.leadTimeDays || 7,
          minStockLevel: part.minStockLevel || 0,
          maxStockLevel: part.maxStockLevel || 100,
          supplierName: part.supplierName,
          stock:
            part.quantityOnHand !== undefined
              ? {
                  id: `stock-${part.id}`,
                  quantityOnHand,
                  quantityReserved,
                  quantityOnOrder: part.quantityOnOrder || 0,
                  availableQuantity,
                  unitCost,
                  location: part.location || "MAIN",
                  status: part.stockStatus || "unknown",
                }
              : null,
        };
      });

      res.json(transformedParts);
    })
  );

  // POST /api/parts-inventory - Create new inventory item
  app.post(
    "/api/parts-inventory",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "create"),
    writeOperationRateLimit,
    withErrorHandling("create parts inventory item", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const dbData = {
        orgId: req.body.orgId || orgId,
        partNumber: req.body.partNumber,
        partName: req.body.partName,
        description: req.body.description,
        category: req.body.category,
        manufacturer: req.body.manufacturer,
        unitCost: req.body.unitCost,
        quantityOnHand: req.body.quantityOnHand || 0,
        quantityReserved: 0,
        minStockLevel: req.body.minStockLevel,
        maxStockLevel: req.body.maxStockLevel,
        location: req.body.location,
        supplierName: req.body.supplierName,
        supplierPartNumber: req.body.supplierPartNumber,
        leadTimeDays: req.body.leadTimeDays || 7,
        isActive: true,
      };

      const validationResult = insertPartsInventorySchema.safeParse(dbData);
      if (!validationResult.success) {
        throw validationResult.error;
      }

      const item = await inventoryService.createInventoryItem(
        validationResult.data,
        req.user?.id
      );

      sendCreated(res, item);
    })
  );

  // PUT /api/parts-inventory/:id - Update inventory item
  app.put(
    "/api/parts-inventory/:id",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update parts inventory item", async (req: Request, res: Response) => {
      const dbData: any = {};
      if (req.body.partNumber !== undefined) { dbData.partNumber = req.body.partNumber; }
      if (req.body.partName !== undefined) { dbData.partName = req.body.partName; }
      if (req.body.description !== undefined) { dbData.description = req.body.description; }
      if (req.body.category !== undefined) { dbData.category = req.body.category; }
      if (req.body.manufacturer !== undefined) { dbData.manufacturer = req.body.manufacturer; }
      if (req.body.unitCost !== undefined) { dbData.unitCost = req.body.unitCost; }
      if (req.body.quantityOnHand !== undefined) { dbData.quantityOnHand = req.body.quantityOnHand; }
      if (req.body.minStockLevel !== undefined) { dbData.minStockLevel = req.body.minStockLevel; }
      if (req.body.maxStockLevel !== undefined) { dbData.maxStockLevel = req.body.maxStockLevel; }
      if (req.body.location !== undefined) { dbData.location = req.body.location; }
      if (req.body.supplierName !== undefined) { dbData.supplierName = req.body.supplierName; }
      if (req.body.supplierPartNumber !== undefined) {
        dbData.supplierPartNumber = req.body.supplierPartNumber;
      }
      if (req.body.leadTimeDays !== undefined) { dbData.leadTimeDays = req.body.leadTimeDays; }
      if (req.body.isActive !== undefined) { dbData.isActive = req.body.isActive; }

      const validationResult = insertPartsInventorySchema.partial().safeParse(dbData);
      if (!validationResult.success) {
        throw validationResult.error;
      }

      const orgId = (req as AuthenticatedRequest).orgId;

      const item = await inventoryService.updateInventoryItem(
        req.params.id,
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

  // PATCH /api/parts-inventory/:id/cost - Update part cost
  app.patch(
    "/api/parts-inventory/:id/cost",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update part cost", async (req: Request, res: Response) => {
      const { unitCost, supplier } = req.body;

      if (unitCost === undefined || !supplier) {
        return res.status(400).json({
          message: "unitCost and supplier are required",
        });
      }

      if (typeof unitCost !== "number" || unitCost < 0) {
        return res.status(400).json({
          message: "unitCost must be a non-negative number",
        });
      }

      const item = await inventoryService.updatePartCost(
        req.params.id,
        { unitCost, supplier },
        req.user?.id
      );

      if (!item) {
        return sendNotFound(res, "Part");
      }

      res.json(item);
    })
  );

  // PATCH /api/parts-inventory/:id/stock - Update part stock quantities
  app.patch(
    "/api/parts-inventory/:id/stock",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update part stock", async (req: Request, res: Response) => {
      const { quantityOnHand, quantityReserved, minStockLevel, maxStockLevel } = req.body;

      const updateData: any = {};
      if (quantityOnHand !== undefined) { updateData.quantityOnHand = quantityOnHand; }
      if (quantityReserved !== undefined) { updateData.quantityReserved = quantityReserved; }
      if (minStockLevel !== undefined) { updateData.minStockLevel = minStockLevel; }
      if (maxStockLevel !== undefined) { updateData.maxStockLevel = maxStockLevel; }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          message:
            "At least one stock field must be provided (quantityOnHand, quantityReserved, minStockLevel, maxStockLevel)",
        });
      }

      for (const [key, value] of Object.entries(updateData)) {
        if (typeof value !== "number" || value < 0) {
          return res.status(400).json({
            message: `${key} must be a non-negative number`,
          });
        }
      }

      const item = await inventoryService.updatePartStock(
        req.params.id,
        updateData,
        req.user?.id
      );

      if (!item) {
        return sendNotFound(res, "Part");
      }

      res.json(item);
    })
  );

  // Register inventory supplier routes
  app.use("/api", inventorySupplierRouter);
}
