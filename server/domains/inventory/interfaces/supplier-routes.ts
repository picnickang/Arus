// @ts-nocheck
import { Router } from "express";
import { z } from "zod";
import { inventorySupplierService } from "../supplier-service";
import { asyncHandler } from "../../../lib/async-handler";
import { createLogger } from "../../../lib/structured-logger";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { createRateLimiter } from "../../../lib/rate-limit-factory";

const logger = createLogger("inventory-supplier-routes");
export const inventorySupplierRouter = Router();

const writeLimit = createRateLimiter("write");
const generalLimit = createRateLimiter("general");

const linkSupplierSchema = z.object({
  supplierId: z.string().min(1),
  supplierPartNumber: z.string().optional(),
  unitCost: z.number().optional(),
  leadTimeDays: z.number().int().optional(),
  isPreferred: z.boolean().optional(),
  notes: z.string().optional(),
});

const bulkLinkSchema = z.object({
  supplierIds: z.array(z.string().min(1)).min(1),
});

const updateLinkSchema = z.object({
  supplierPartNumber: z.string().optional(),
  unitCost: z.number().optional(),
  leadTimeDays: z.number().int().optional(),
  isPreferred: z.boolean().optional(),
  notes: z.string().optional(),
});

const setPreferredSchema = z.object({
  supplierId: z.string().min(1),
});

inventorySupplierRouter.get(
  "/inventory/:inventoryItemId/suppliers",
  requireOrgId,
  generalLimit,
  asyncHandler(async (req, res) => {
    const { inventoryItemId } = req.params;
    const links = await inventorySupplierService.getSupplierLinks(inventoryItemId);
    const flattenedLinks = links.map((link) => ({
      ...link,
      supplierName: link.supplier?.name,
    }));
    res.json(flattenedLinks);
  })
);

inventorySupplierRouter.post(
  "/inventory/:inventoryItemId/suppliers",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { inventoryItemId } = req.params;
    const data = linkSupplierSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    try {
      const link = await inventorySupplierService.linkSupplier(
        { inventoryItemId, ...data },
        userId
      );
      logger.info("Linked supplier to inventory item", {
        inventoryItemId,
        supplierId: data.supplierId,
      });
      res.status(201).json(link);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already linked")) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

inventorySupplierRouter.post(
  "/inventory/:inventoryItemId/suppliers/bulk",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { inventoryItemId } = req.params;
    const { supplierIds } = bulkLinkSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    const links = await inventorySupplierService.bulkLinkSuppliers(
      inventoryItemId,
      supplierIds,
      userId
    );
    logger.info("Bulk linked suppliers to inventory item", {
      inventoryItemId,
      count: links.length,
    });
    res.status(201).json(links);
  })
);

inventorySupplierRouter.put(
  "/inventory/:inventoryItemId/suppliers/replace",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { inventoryItemId } = req.params;
    const { supplierIds } = z.object({ supplierIds: z.array(z.string()) }).parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    const links = await inventorySupplierService.replaceSupplierLinks(
      inventoryItemId,
      supplierIds,
      userId
    );
    logger.info("Replaced supplier links for inventory item", {
      inventoryItemId,
      count: links.length,
    });
    res.json(links);
  })
);

inventorySupplierRouter.put(
  "/inventory/:inventoryItemId/suppliers",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { inventoryItemId } = req.params;
    const schema = z.object({
      supplierIds: z.array(z.string()),
      preferredSupplierId: z.string().optional(),
    });
    const { supplierIds, preferredSupplierId } = schema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    const links = await inventorySupplierService.replaceSupplierLinks(
      inventoryItemId,
      supplierIds,
      userId
    );

    if (preferredSupplierId && supplierIds.includes(preferredSupplierId)) {
      await inventorySupplierService.setPreferredSupplier(
        inventoryItemId,
        preferredSupplierId,
        userId
      );
    }

    logger.info("Updated supplier links for inventory item", {
      inventoryItemId,
      count: links.length,
      preferredSupplierId,
    });
    res.json(links);
  })
);

inventorySupplierRouter.patch(
  "/inventory/supplier-links/:linkId",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { linkId } = req.params;
    const data = updateLinkSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    const link = await inventorySupplierService.updateSupplierLink(linkId, data, userId);
    if (!link) {
      res.status(404).json({ error: "Supplier link not found" });
      return;
    }
    logger.info("Updated supplier link", { linkId });
    res.json(link);
  })
);

inventorySupplierRouter.delete(
  "/inventory/supplier-links/:linkId",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { linkId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.id;

    const deleted = await inventorySupplierService.unlinkSupplier(linkId, userId);
    if (!deleted) {
      res.status(404).json({ error: "Supplier link not found" });
      return;
    }
    logger.info("Deleted supplier link", { linkId });
    res.status(204).send();
  })
);

inventorySupplierRouter.post(
  "/inventory/:inventoryItemId/suppliers/preferred",
  requireOrgId,
  writeLimit,
  asyncHandler(async (req, res) => {
    const { inventoryItemId } = req.params;
    const { supplierId } = setPreferredSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    try {
      await inventorySupplierService.setPreferredSupplier(inventoryItemId, supplierId, userId);
      logger.info("Set preferred supplier", { inventoryItemId, supplierId });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not linked")) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  })
);

inventorySupplierRouter.get(
  "/suppliers/:supplierId/inventory-items",
  requireOrgId,
  generalLimit,
  asyncHandler(async (req, res) => {
    const { supplierId } = req.params;
    const links = await inventorySupplierService.getInventoryItemsForSupplier(supplierId);
    res.json(links);
  })
);
