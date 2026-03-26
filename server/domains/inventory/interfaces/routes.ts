/**
 * Inventory Domain Routes — Interfaces Layer
 *
 * Improvements applied:
 * #1  — GET /api/parts-inventory now uses getPartsInventoryPaginated (server-side
 *        filtering + pagination) instead of fetching the full catalog and returning
 *        it all. The existing getPartsInventoryPaginated method was already defined
 *        in IInventoryStorage but was never called from this route.
 * #6  — GET /api/parts-inventory/low-stock-suggestions returns parts below min stock
 *        with a "Create PR" action hint, closing the loop between low-stock detection
 *        and the purchasing workflow.
 * #7  — GET /api/parts-inventory/low-stock-suggestions is the entry point for the
 *        "Low Stock → Create PR" shortcut.
 */

import type { Express, Request, Response } from "express";
import { inventoryService } from "../service";
import { inventorySupplierRouter } from "./supplier-routes";
import { insertPartsInventorySchema } from "@shared/schema-runtime";
import { requireOrgId, requireOrgIdAndValidateBody, AuthenticatedRequest } from "../../../middleware/auth";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import { requirePermission } from "../../permissions/middleware";

export function registerInventoryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ── Parts catalog endpoints ────────────────────────────────────────────────

  app.get("/api/parts", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch parts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parts = await inventoryService.listParts(orgId);
      res.json(parts);
    })
  );

  app.delete("/api/parts/:id", requireOrgId, requirePermission("inventory", "delete"), criticalOperationRateLimit,
    withErrorHandling("delete part", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await inventoryService.deletePart(req.params.id, orgId, req.user?.id);
      sendDeleted(res);
    })
  );

  app.post("/api/parts/availability", requireOrgId, generalApiRateLimit,
    withErrorHandling("check part availability", async (req: Request, res: Response) => {
      const { partId, quantity } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;
      if (!partId || !quantity) {
        return res.status(400).json({ message: "partId and quantity are required" });
      }
      const availability = await inventoryService.checkAvailability(partId, quantity, orgId);
      res.json(availability);
    })
  );

  app.post("/api/parts/:id/sync-costs", requireOrgId, requirePermission("inventory", "edit"), writeOperationRateLimit,
    withErrorHandling("sync part costs", async (req: Request, res: Response) => {
      await inventoryService.syncPartCosts(req.params.id, req.user?.id);
      res.json({ message: "Part costs synchronized successfully", partId: req.params.id });
    })
  );

  app.get("/api/parts/:partId/compatible-equipment", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch compatible equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipment = await inventoryService.getCompatibleEquipment(req.params.partId, orgId);
      res.json(equipment);
    })
  );

  app.patch("/api/parts/:partId/compatibility", requireOrgIdAndValidateBody, requirePermission("inventory", "edit"), writeOperationRateLimit,
    withErrorHandling("update part compatibility", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentIds } = req.body;
      if (!Array.isArray(equipmentIds)) {
        return res.status(400).json({ message: "equipmentIds must be an array" });
      }
      const part = await inventoryService.updateCompatibility(req.params.partId, equipmentIds, orgId, req.user?.id);
      res.json(part);
    })
  );

  // ── Parts Inventory endpoints ──────────────────────────────────────────────

  /**
   * Improvement #1: Server-side pagination and filtering.
   * Previously fetched all parts into memory and returned the full list.
   * Now delegates filtering and pagination to getPartsInventoryPaginated
   * which runs WHERE/LIMIT/OFFSET in the database.
   *
   * Query params accepted:
   *   page, limit, search, category, criticality, stockStatus, supplier, sortBy, sortOrder
   */
  app.get("/api/parts-inventory", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch parts inventory", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const {
        search, category, criticality, stockStatus, supplier,
        sortBy, sortOrder,
      } = req.query;

      const limit  = Math.min(Number.parseInt(req.query.limit  as string || "50",  10), 200);
      const page   = Math.max(Number.parseInt(req.query.page   as string || "1",   10), 1);
      const offset = (page - 1) * limit;

      // Improvement #1: use the paginated method that was already defined but never called
      const { items, total } = await inventoryService.listPartsInventoryPaginated(orgId, {
        limit,
        offset,
        search:      search      as string | undefined,
        category:    category    as string | undefined,
        criticality: criticality as string | undefined,
        stockStatus: stockStatus as any,
        supplier:    supplier    as string | undefined,
        sortBy:      sortBy      as string | undefined,
        sortOrder:   sortOrder   as "asc" | "desc" | undefined,
      });

      // Transform to match frontend expectations
      const transformedParts = items.map((part: any) => {
        const quantityOnHand    = part.quantityOnHand    || 0;
        const quantityReserved  = part.quantityReserved  || 0;
        const availableQuantity = quantityOnHand - quantityReserved;
        const unitCost          = part.unitCost          || 0;

        return {
          id:            part.id,
          partNumber:    part.partNumber,
          partName:      part.partName,
          description:   part.description,
          category:      part.category,
          unitOfMeasure: part.unitOfMeasure || "ea",
          standardCost:  unitCost,
          criticality:   part.criticality || "medium",
          leadTimeDays:  part.leadTimeDays || 7,
          minStockLevel: part.minStockLevel || 0,
          maxStockLevel: part.maxStockLevel || 100,
          supplierName:  part.supplierName,
          supplierId:    part.supplierId,
          stock: part.quantityOnHand !== undefined ? {
            id:               `stock-${part.id}`,
            quantityOnHand,
            quantityReserved,
            quantityOnOrder:  part.quantityOnOrder || 0,
            availableQuantity,
            unitCost,
            location:         part.location || "MAIN",
            status:           part.stockStatus || "unknown",
          } : null,
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

  /**
   * Improvement #7: Low-stock replenishment suggestions.
   * Returns parts at or below minStockLevel with estimated reorder quantities.
   * Frontend uses this to populate the "Create Purchase Request" shortcut
   * that appears when the Critical/Out or Low Stock stat card is clicked.
   */
  app.get("/api/parts-inventory/low-stock-suggestions", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch low stock suggestions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const lowStockParts = await inventoryService.getLowStockParts(orgId);

      const suggestions = lowStockParts.map((part: any) => {
        const currentQty    = part.quantityOnHand    || 0;
        const minLevel      = part.minStockLevel      || 0;
        const maxLevel      = part.maxStockLevel      || minLevel * 3 || 10;
        const reorderQty    = Math.max(1, maxLevel - currentQty);

        return {
          partId:          part.id,
          partNumber:      part.partNumber,
          partName:        part.partName,
          category:        part.category,
          criticality:     part.criticality,
          quantityOnHand:  currentQty,
          minStockLevel:   minLevel,
          maxStockLevel:   maxLevel,
          suggestedOrderQty: reorderQty,
          supplierId:      part.supplierId,
          supplierName:    part.supplierName,
          leadTimeDays:    part.leadTimeDays || 7,
          estimatedCost:   reorderQty * (part.unitCost || 0),
        };
      });

      // Sort by criticality then by how far below min stock
      const criticalityOrder: Record<string, number> = {
        critical: 0, high: 1, medium: 2, low: 3,
      };
      suggestions.sort((a: any, b: any) => {
        const critDiff = (criticalityOrder[a.criticality] ?? 4) - (criticalityOrder[b.criticality] ?? 4);
        if (critDiff !== 0) return critDiff;
        return (a.quantityOnHand - a.minStockLevel) - (b.quantityOnHand - b.minStockLevel);
      });

      res.json({
        total: suggestions.length,
        suggestions,
        estimatedTotalCost: suggestions.reduce((sum: number, s: any) => sum + s.estimatedCost, 0),
      });
    })
  );

  app.post("/api/parts-inventory", requireOrgIdAndValidateBody, requirePermission("inventory", "create"), writeOperationRateLimit,
    withErrorHandling("create parts inventory item", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const dbData = {
        orgId:               req.body.orgId || orgId,
        partNumber:          req.body.partNumber,
        partName:            req.body.partName,
        description:         req.body.description,
        category:            req.body.category,
        manufacturer:        req.body.manufacturer,
        unitCost:            req.body.unitCost,
        quantityOnHand:      req.body.quantityOnHand || 0,
        quantityReserved:    0,
        minStockLevel:       req.body.minStockLevel,
        maxStockLevel:       req.body.maxStockLevel,
        location:            req.body.location,
        supplierName:        req.body.supplierName,
        supplierPartNumber:  req.body.supplierPartNumber,
        leadTimeDays:        req.body.leadTimeDays || 7,
        isActive:            true,
      };

      const validationResult = insertPartsInventorySchema.safeParse(dbData);
      if (!validationResult.success) throw validationResult.error;

      const item = await inventoryService.createInventoryItem(validationResult.data, req.user?.id);
      sendCreated(res, item);
    })
  );

  app.put("/api/parts-inventory/:id", requireOrgIdAndValidateBody, requirePermission("inventory", "edit"), writeOperationRateLimit,
    withErrorHandling("update parts inventory item", async (req: Request, res: Response) => {
      const dbData: any = {};
      const fields = [
        "partNumber","partName","description","category","manufacturer",
        "unitCost","quantityOnHand","minStockLevel","maxStockLevel",
        "location","supplierName","supplierPartNumber","leadTimeDays","isActive",
      ];
      for (const f of fields) {
        if (req.body[f] !== undefined) dbData[f] = req.body[f];
      }

      const validationResult = insertPartsInventorySchema.partial().safeParse(dbData);
      if (!validationResult.success) throw validationResult.error;

      const orgId = (req as AuthenticatedRequest).orgId;
      const item  = await inventoryService.updateInventoryItem(req.params.id, validationResult.data, req.user?.id, orgId);
      if (!item) return sendNotFound(res, "Part");
      res.json(item);
    })
  );

  app.patch("/api/parts-inventory/:id/cost", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("update part cost", async (req: Request, res: Response) => {
      const { unitCost, supplier } = req.body;
      if (unitCost === undefined || !supplier) {
        return res.status(400).json({ message: "unitCost and supplier are required" });
      }
      if (typeof unitCost !== "number" || unitCost < 0) {
        return res.status(400).json({ message: "unitCost must be a non-negative number" });
      }
      const item = await inventoryService.updatePartCost(req.params.id, { unitCost, supplier }, req.user?.id);
      if (!item) return sendNotFound(res, "Part");
      res.json(item);
    })
  );

  app.patch("/api/parts-inventory/:id/stock", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("update part stock", async (req: Request, res: Response) => {
      const { quantityOnHand, quantityReserved, minStockLevel, maxStockLevel } = req.body;
      const updateData: any = {};
      if (quantityOnHand   !== undefined) updateData.quantityOnHand   = quantityOnHand;
      if (quantityReserved !== undefined) updateData.quantityReserved = quantityReserved;
      if (minStockLevel    !== undefined) updateData.minStockLevel    = minStockLevel;
      if (maxStockLevel    !== undefined) updateData.maxStockLevel    = maxStockLevel;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "At least one stock field must be provided" });
      }
      for (const [key, value] of Object.entries(updateData)) {
        if (typeof value !== "number" || value < 0) {
          return res.status(400).json({ message: `${key} must be a non-negative number` });
        }
      }

      const item = await inventoryService.updatePartStock(req.params.id, updateData, req.user?.id);
      if (!item) return sendNotFound(res, "Part");
      res.json(item);
    })
  );

  app.use("/api", inventorySupplierRouter);
}
