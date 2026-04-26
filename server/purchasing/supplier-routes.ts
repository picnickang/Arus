/**
 * Part-Supplier Link Routes
 * REST endpoints for linking suppliers to parts
 */

import { Router } from "express";
import type { Request, Response } from "express";
import * as service from "./service";
import { createLogger } from "../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Purchasing:SupplierRoutes");

export const supplierLinkRouter = Router();

supplierLinkRouter.get("/parts/:partId/suppliers", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const suppliers = await service.getPartSuppliers(req.params.partId, orgId);
    res.json(suppliers);
  } catch (error) {
    logger.error("[Purchasing] Error getting part suppliers:", undefined, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

supplierLinkRouter.post("/parts/:partId/suppliers", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

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
    logger.error("[Purchasing] Error linking supplier to part:", undefined, error);
    res.status(400).json({ error: (error as Error).message });
  }
});

supplierLinkRouter.delete(
  "/parts/:partId/suppliers/:supplierId",
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;

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
      logger.error("[Purchasing] Error unlinking supplier from part:", undefined, error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);
