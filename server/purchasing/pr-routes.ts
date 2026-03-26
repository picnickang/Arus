/**
 * Purchase Request Routes
 *
 * Improvements applied:
 * #9  — POST /:id/items now returns substitutionSuggestions when the added
 *        part is out of stock, so the frontend can show alternatives immediately.
 * #14 — POST /:id/auto-save provides a debounce-friendly endpoint that saves
 *        draft state without requiring the PR to be in "draft" status.
 * #18 — DELETE /:id no longer fetches the PR twice (removed redundant second
 *        fetch inside deletePurchaseRequest — the route now passes status directly).
 */

import { Router } from "express";
import type { Request, Response } from "express";
import * as service from "./service";
import { updatePRDraft } from "./pr-draft-service";
import type { PRListFilters, PRStatus } from "./types";
import { canModifyRecord, PR_PERMISSION_GUARD } from "../lib/status-permission-guard";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  purchaseRequests,
  purchaseRequestItems,
  purchaseRequestEvents,
} from "@shared/schema";

export const prRouter = Router();

// ── POST /purchase-requests ────────────────────────────────────────────────────
prRouter.post("/purchase-requests", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const { requestedBy, vesselId, notes, workOrderId } = req.body;
    if (!requestedBy) return res.status(400).json({ error: "requestedBy is required" });

    const pr = await service.createDraftPR(orgId, requestedBy, vesselId, notes, workOrderId);
    res.status(201).json(pr);
  } catch (error) {
    console.error("[Purchasing] Error creating PR:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ── GET /purchase-requests ─────────────────────────────────────────────────────
prRouter.get("/purchase-requests", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const filters: PRListFilters = {
      orgId,
      status:      req.query.status as PRStatus | undefined,
      vesselId:    req.query.vesselId as string | undefined,
      requestedBy: req.query.requestedBy as string | undefined,
      limit:       req.query.limit  ? Number.parseInt(req.query.limit  as string, 10) : 50,
      offset:      req.query.offset ? Number.parseInt(req.query.offset as string, 10) : 0,
    };
    if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
    if (req.query.toDate)   filters.toDate   = new Date(req.query.toDate as string);

    const prs = await service.listPRs(filters);
    res.json(prs);
  } catch (error) {
    console.error("[Purchasing] Error listing PRs:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ── GET /purchase-requests/:id ─────────────────────────────────────────────────
prRouter.get("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const pr = await service.getPR(req.params.id, orgId);
    if (!pr) return res.status(404).json({ error: "Purchase request not found" });
    res.json(pr);
  } catch (error) {
    console.error("[Purchasing] Error getting PR:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ── PATCH /purchase-requests/:id ──────────────────────────────────────────────
prRouter.patch("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const existingPR = await service.getPR(req.params.id, orgId);
    if (!existingPR) return res.status(404).json({ error: "Purchase request not found" });

    if (userId) {
      const permCheck = await canModifyRecord(userId, orgId, existingPR.status, PR_PERMISSION_GUARD);
      if (!permCheck.allowed) {
        return res.status(403).json({ error: "Forbidden", message: permCheck.reason, code: "INSUFFICIENT_PERMISSIONS" });
      }
    }

    const { requiredByDate, deliveryLocation, notes, vesselId } = req.body;
    const updates: Record<string, unknown> = {};
    if (requiredByDate !== undefined)   updates.requiredByDate   = new Date(requiredByDate);
    if (deliveryLocation !== undefined) updates.deliveryLocation = deliveryLocation;
    if (notes !== undefined)            updates.notes            = notes;
    if (vesselId !== undefined)         updates.vesselId         = vesselId;

    const pr = await service.updatePRDraft(req.params.id, orgId, updates as any, userId);
    res.json(pr);
  } catch (error) {
    console.error("[Purchasing] Error updating PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── POST /purchase-requests/:id/auto-save — Improvement #14 ──────────────────
/**
 * Debounce-friendly auto-save endpoint.
 * Does not require the PR to be in "draft" status.
 * Frontend calls this every 30 seconds of inactivity to preserve work.
 */
prRouter.post("/purchase-requests/:id/auto-save", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const { notes, vesselId, requiredByDate, deliveryLocation } = req.body;
    const updates: Record<string, unknown> = {};
    if (notes !== undefined)            updates.notes            = notes;
    if (vesselId !== undefined)         updates.vesselId         = vesselId;
    if (requiredByDate !== undefined)   updates.requiredByDate   = new Date(requiredByDate);
    if (deliveryLocation !== undefined) updates.deliveryLocation = deliveryLocation;

    const pr = await updatePRDraft(req.params.id, orgId, updates as any, userId, { isAutoSave: true });
    res.json({ success: true, lastSavedAt: pr?.lastDraftSaveAt });
  } catch (error) {
    console.error("[Purchasing] Error auto-saving PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── POST /purchase-requests/:id/items ─────────────────────────────────────────
prRouter.post("/purchase-requests/:id/items", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const { partId, supplierId, quantity, uom, remarks } = req.body;
    if (!partId || quantity === undefined) {
      return res.status(400).json({ error: "partId and quantity are required" });
    }

    // Improvement #9: result now includes substitution suggestions when out of stock
    const result = await service.addItemToPR(
      req.params.id, orgId, { partId, supplierId, quantity, uom, remarks }, userId
    );

    res.status(201).json(result);
  } catch (error) {
    console.error("[Purchasing] Error adding item to PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── DELETE /purchase-requests/:id/items/:itemId ────────────────────────────────
prRouter.delete("/purchase-requests/:id/items/:itemId", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const removed = await service.removeItemFromPR(
      req.params.id, req.params.itemId, orgId, userId
    );

    if (!removed) return res.status(404).json({ error: "Item not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Purchasing] Error removing item from PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── POST /purchase-requests/:id/send ─────────────────────────────────────────
prRouter.post("/purchase-requests/:id/send", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const result = await service.sendPR(req.params.id, orgId, userId);
    res.json(result);
  } catch (error) {
    console.error("[Purchasing] Error sending PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── POST /purchase-requests/:id/cancel ────────────────────────────────────────
prRouter.post("/purchase-requests/:id/cancel", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const pr = await service.cancelPR(req.params.id, orgId, userId);
    res.json(pr);
  } catch (error) {
    console.error("[Purchasing] Error cancelling PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── POST /purchase-requests/:id/close ─────────────────────────────────────────
prRouter.post("/purchase-requests/:id/close", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const pr = await service.closePR(req.params.id, orgId, userId);
    res.json(pr);
  } catch (error) {
    console.error("[Purchasing] Error closing PR:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── DELETE /purchase-requests/:id — Improvement #18 ──────────────────────────
/**
 * FIX: Previously called service.getPR (with items join) to check status,
 * then deletePurchaseRequest called getPurchaseRequestById again — two fetches.
 * Now fetches once with getPurchaseRequestById (no join needed for status check).
 */
prRouter.delete("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    // Improvement #18: single fetch — no join needed for status + permission check
    const { getPurchaseRequestById } = await import("./repository");
    const existingPR = await getPurchaseRequestById(req.params.id, orgId);
    if (!existingPR) return res.status(404).json({ error: "Purchase request not found" });

    if (userId) {
      const permCheck = await canModifyRecord(userId, orgId, existingPR.status, PR_PERMISSION_GUARD);
      if (!permCheck.allowed) {
        return res.status(403).json({ error: "Forbidden", message: permCheck.reason, code: "INSUFFICIENT_PERMISSIONS" });
      }
    }

    const status = existingPR.status as PRStatus;
    if (status !== "draft" && status !== "cancelled") {
      return res.status(400).json({ error: "Only draft or cancelled requests can be deleted" });
    }

    // Delete in FK order: events → items → PR
    await db.delete(purchaseRequestEvents).where(
      and(eq(purchaseRequestEvents.prId, req.params.id), eq(purchaseRequestEvents.orgId, orgId))
    );
    await db.delete(purchaseRequestItems).where(
      and(eq(purchaseRequestItems.prId, req.params.id), eq(purchaseRequestItems.orgId, orgId))
    );
    await db.delete(purchaseRequests).where(
      and(eq(purchaseRequests.id, req.params.id), eq(purchaseRequests.orgId, orgId))
    );

    res.json({ success: true });
  } catch (error) {
    console.error("[Purchasing] Error deleting PR:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ── PATCH /purchase-requests/:id/status ───────────────────────────────────────
prRouter.patch("/purchase-requests/:id/status", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const { status: newStatus } = req.body;
    if (!newStatus) return res.status(400).json({ error: "status is required" });

    const { updatePRStatus } = await import("./fulfillment-service");
    const result = await updatePRStatus(req.params.id, orgId, newStatus, userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.pr);
  } catch (error) {
    console.error("[Purchasing] Error updating PR status:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ── POST /purchase-requests/:id/items/:itemId/fulfill ─────────────────────────
prRouter.post("/purchase-requests/:id/items/:itemId/fulfill", async (req: Request, res: Response) => {
  try {
    const orgId  = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const { quantityToFulfill } = req.body;
    if (quantityToFulfill === undefined || quantityToFulfill <= 0) {
      return res.status(400).json({ error: "quantityToFulfill must be a positive number" });
    }

    const { fulfillItem } = await import("./fulfillment-service");
    const result = await fulfillItem({
      prId: req.params.id, itemId: req.params.itemId,
      orgId, quantityToFulfill, fulfilledBy: userId || "system",
    });

    res.json(result);
  } catch (error) {
    console.error("[Purchasing] Error fulfilling item:", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// ── DELETE /purchase-requests/bulk/by-work-order/:workOrderId ─────────────────
prRouter.delete("/purchase-requests/bulk/by-work-order/:workOrderId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    const { deleteAllPurchaseRequestsByWorkOrder } = await import("./fulfillment-service");
    const result = await deleteAllPurchaseRequestsByWorkOrder(req.params.workOrderId, orgId);
    res.json(result);
  } catch (error) {
    console.error("[Purchasing] Error bulk deleting PRs:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
