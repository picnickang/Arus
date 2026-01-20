/**
 * Part-Supplier Link Routes
 * REST endpoints for linking suppliers to parts
 */

import { Router } from "express";
import type { Request, Response } from "express";
import * as service from "./service";

export const supplierLinkRouter = Router();

supplierLinkRouter.get(
  "/parts/:partId/suppliers",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const suppliers = await service.getPartSuppliers(req.params.partId, orgId);
      res.json(suppliers);
    } catch (error) {
      console.error("[Purchasing] Error getting part suppliers:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

supplierLinkRouter.post(
  "/parts/:partId/suppliers",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { supplierId, isPrimary, supplierPartNumber, unitCost, leadTimeDays, notes } = req.body;
      if (!supplierId) {
        return res.status(400).json({ error: "supplierId is required" });
      }

      const link = await service.linkSupplierToPart({
        orgId,
        partId: req.params.partId,
        supplierId,
        isPrimary,
        supplierPartNumber,
        unitCost,
        leadTimeDays,
        notes,
      });
      res.status(201).json(link);
    } catch (error) {
      console.error("[Purchasing] Error linking supplier to part:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

supplierLinkRouter.delete(
  "/parts/:partId/suppliers/:supplierId",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const removed = await service.unlinkSupplierFromPart(
        req.params.partId,
        req.params.supplierId,
        orgId
      );

      if (!removed) {
        return res.status(404).json({ error: "Link not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Purchasing] Error unlinking supplier from part:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);
