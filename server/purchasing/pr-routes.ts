/**
 * Purchase Request Routes
 * REST endpoints for PR CRUD and workflow
 */

import { Router } from "express";
import type { Request, Response } from "express";
import * as service from "./service";
import type { PRListFilters, PRStatus } from "./types";
import { canModifyRecord, PR_PERMISSION_GUARD } from "../lib/status-permission-guard";

export const prRouter = Router();

prRouter.post("/purchase-requests", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const { requestedBy, vesselId, notes, workOrderId } = req.body;
    if (!requestedBy) {
      return res.status(400).json({ error: "requestedBy is required" });
    }

    const pr = await service.createDraftPR(orgId, requestedBy, vesselId, notes, workOrderId);
    res.status(201).json(pr);
  } catch (error) {
    console.error("[Purchasing] Error creating PR:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

prRouter.get("/purchase-requests", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const filters: PRListFilters = {
      orgId,
      status: req.query.status as PRStatus | undefined,
      vesselId: req.query.vesselId as string | undefined,
      requestedBy: req.query.requestedBy as string | undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? Number.parseInt(req.query.offset as string, 10) : 0,
    };

    if (req.query.fromDate) {
      filters.fromDate = new Date(req.query.fromDate as string);
    }

    if (req.query.toDate) {
      filters.toDate = new Date(req.query.toDate as string);
    }

    const prs = await service.listPRs(filters);
    res.json(prs);
  } catch (error) {
    console.error("[Purchasing] Error listing PRs:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

prRouter.get("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const pr = await service.getPR(req.params.id, orgId);
    if (!pr) {
      return res.status(404).json({ error: "Purchase request not found" });
    }

    res.json(pr);
  } catch (error) {
    console.error("[Purchasing] Error getting PR:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

prRouter.patch("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const existingPR = await service.getPR(req.params.id, orgId);
    if (!existingPR) {
      return res.status(404).json({ error: "Purchase request not found" });
    }

    if (userId) {
      const permCheck = await canModifyRecord(userId, orgId, existingPR.status, PR_PERMISSION_GUARD);
      if (!permCheck.allowed) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: permCheck.reason,
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
    }

    const { requiredByDate, deliveryLocation, notes, vesselId } = req.body;
    const updates: Record<string, unknown> = {};

    if (requiredByDate !== undefined)
      {updates.requiredByDate = new Date(requiredByDate);}
    if (deliveryLocation !== undefined)
      {updates.deliveryLocation = deliveryLocation;}
    if (notes !== undefined) {updates.notes = notes;}
    if (vesselId !== undefined) {updates.vesselId = vesselId;}

    const pr = await service.updatePRDraft(
      req.params.id,
      orgId,
      updates as any,
      userId
    );
    res.json(pr);
  } catch (error) {
    console.error("[Purchasing] Error updating PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

prRouter.post(
  "/purchase-requests/:id/items",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      const userId = req.headers["x-user-id"] as string | undefined;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { partId, supplierId, quantity, uom, remarks } = req.body;
      if (!partId || quantity === undefined) {
        return res
          .status(400)
          .json({ error: "partId and quantity are required" });
      }

      const item = await service.addItemToPR(
        req.params.id,
        orgId,
        { partId, supplierId, quantity, uom, remarks },
        userId
      );
      res.status(201).json(item);
    } catch (error) {
      console.error("[Purchasing] Error adding item to PR:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

prRouter.delete(
  "/purchase-requests/:id/items/:itemId",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      const userId = req.headers["x-user-id"] as string | undefined;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const removed = await service.removeItemFromPR(
        req.params.id,
        req.params.itemId,
        orgId,
        userId
      );

      if (!removed) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Purchasing] Error removing item from PR:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

prRouter.post(
  "/purchase-requests/:id/send",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      const userId = req.headers["x-user-id"] as string | undefined;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const result = await service.sendPR(req.params.id, orgId, userId);
      res.json(result);
    } catch (error) {
      console.error("[Purchasing] Error sending PR:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

prRouter.post(
  "/purchase-requests/:id/cancel",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      const userId = req.headers["x-user-id"] as string | undefined;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const pr = await service.cancelPR(req.params.id, orgId, userId);
      res.json(pr);
    } catch (error) {
      console.error("[Purchasing] Error cancelling PR:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

prRouter.post(
  "/purchase-requests/:id/close",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      const userId = req.headers["x-user-id"] as string | undefined;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const pr = await service.closePR(req.params.id, orgId, userId);
      res.json(pr);
    } catch (error) {
      console.error("[Purchasing] Error closing PR:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

prRouter.delete("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const existingPR = await service.getPR(req.params.id, orgId);
    if (!existingPR) {
      return res.status(404).json({ error: "Purchase request not found" });
    }

    if (userId) {
      const permCheck = await canModifyRecord(userId, orgId, existingPR.status, PR_PERMISSION_GUARD);
      if (!permCheck.allowed) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: permCheck.reason,
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
    }

    const { deletePurchaseRequest } = await import("./fulfillment-service");
    const result = await deletePurchaseRequest(req.params.id, orgId, userId);

    if (!result.success) {
      const status = result.error === "Purchase request not found" ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Purchasing] Error deleting PR:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

prRouter.patch("/purchase-requests/:id/status", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const { status: newStatus } = req.body;
    if (!newStatus) {
      return res.status(400).json({ error: "status is required" });
    }

    const { updatePRStatus } = await import("./fulfillment-service");
    const result = await updatePRStatus(req.params.id, orgId, newStatus, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.pr);
  } catch (error) {
    console.error("[Purchasing] Error updating PR status:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

prRouter.post(
  "/purchase-requests/:id/items/:itemId/fulfill",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      const userId = req.headers["x-user-id"] as string | undefined;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { quantityToFulfill } = req.body;
      if (quantityToFulfill === undefined || quantityToFulfill <= 0) {
        return res.status(400).json({ error: "quantityToFulfill must be a positive number" });
      }

      const { fulfillItem } = await import("./fulfillment-service");
      const result = await fulfillItem({
        prId: req.params.id,
        itemId: req.params.itemId,
        orgId,
        quantityToFulfill,
        fulfilledBy: userId || "system",
      });

      res.json(result);
    } catch (error) {
      console.error("[Purchasing] Error fulfilling item:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  }
);

prRouter.delete(
  "/purchase-requests/bulk/by-work-order/:workOrderId",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { deleteAllPurchaseRequestsByWorkOrder } = await import("./fulfillment-service");
      const result = await deleteAllPurchaseRequestsByWorkOrder(req.params.workOrderId, orgId);
      res.json(result);
    } catch (error) {
      console.error("[Purchasing] Error bulk deleting PRs:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);
