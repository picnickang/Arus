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
import { purchaseRequests, purchaseRequestItems, purchaseRequestEvents } from "@shared/schema";
import { createLogger } from "../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Purchasing:PrRoutes");

/**
 * Express types req.params as `Record<string, string | undefined>` under
 * noUncheckedIndexedAccess, but the underlying route pattern guarantees the
 * matched segment is present. Funnel each path-param lookup through this
 * helper so the unreachable-undefined branch is collapsed in one place.
 */
function pathParam(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string" || v === "") {
    throw new Error(`Missing required path parameter: ${name}`);
  }
  return v;
}

export const prRouter = Router();

// ── POST /purchase-requests ────────────────────────────────────────────────────
prRouter.post("/purchase-requests", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const { requestedBy, vesselId, notes, workOrderId } = req.body;
    if (!requestedBy) {
      return res.status(400).json({ error: "requestedBy is required" });
    }

    const pr = await service.createDraftPR(orgId, requestedBy, vesselId, notes, workOrderId);
    return res.status(201).json(pr);
  } catch (error) {
    logger.error("[Purchasing] Error creating PR:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── GET /purchase-requests ─────────────────────────────────────────────────────
prRouter.get("/purchase-requests", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const filters: PRListFilters = {
      orgId,
      ...(req.query["status"] !== undefined && { status: req.query["status"] as PRStatus }),
      ...(req.query["vesselId"] !== undefined && { vesselId: req.query["vesselId"] as string }),
      ...(req.query["requestedBy"] !== undefined && {
        requestedBy: req.query["requestedBy"] as string,
      }),
      limit: req.query["limit"] ? Number.parseInt(req.query["limit"] as string, 10) : 50,
      offset: req.query["offset"] ? Number.parseInt(req.query["offset"] as string, 10) : 0,
    };
    if (req.query["fromDate"]) {
      filters.fromDate = new Date(req.query["fromDate"] as string);
    }
    if (req.query["toDate"]) {
      filters.toDate = new Date(req.query["toDate"] as string);
    }

    const prs = await service.listPRs(filters);
    return res.json(prs);
  } catch (error) {
    logger.error("[Purchasing] Error listing PRs:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── GET /purchase-requests/:id ─────────────────────────────────────────────────
prRouter.get("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const pr = await service.getPR(pathParam(req, "id"), orgId);
    if (!pr) {
      return res.status(404).json({ error: "Purchase request not found" });
    }
    return res.json(pr);
  } catch (error) {
    logger.error("[Purchasing] Error getting PR:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── PATCH /purchase-requests/:id ──────────────────────────────────────────────
prRouter.patch("/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const existingPR = await service.getPR(pathParam(req, "id"), orgId);
    if (!existingPR) {
      return res.status(404).json({ error: "Purchase request not found" });
    }

    if (userId) {
      const permCheck = await canModifyRecord(
        userId,
        orgId,
        existingPR.status,
        PR_PERMISSION_GUARD
      );
      if (!permCheck.allowed) {
        return res.status(403).json({
          error: "Forbidden",
          message: permCheck.reason,
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    }

    const { requiredByDate, deliveryLocation, notes, vesselId } = req.body;
    const updates: Record<string, unknown> = {};
    if (requiredByDate !== undefined) {
      updates["requiredByDate"] = new Date(requiredByDate);
    }
    if (deliveryLocation !== undefined) {
      updates["deliveryLocation"] = deliveryLocation;
    }
    if (notes !== undefined) {
      updates["notes"] = notes;
    }
    if (vesselId !== undefined) {
      updates["vesselId"] = vesselId;
    }

    const pr = await service.updatePRDraft(
      pathParam(req, "id"),
      orgId,
      updates as object as Parameters<typeof service.updatePRDraft>[2],
      userId
    );
    return res.json(pr);
  } catch (error) {
    logger.error("[Purchasing] Error updating PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const { notes, vesselId, requiredByDate, deliveryLocation } = req.body;
    const updates: Record<string, unknown> = {};
    if (notes !== undefined) {
      updates["notes"] = notes;
    }
    if (vesselId !== undefined) {
      updates["vesselId"] = vesselId;
    }
    if (requiredByDate !== undefined) {
      updates["requiredByDate"] = new Date(requiredByDate);
    }
    if (deliveryLocation !== undefined) {
      updates["deliveryLocation"] = deliveryLocation;
    }

    const pr = await updatePRDraft(
      pathParam(req, "id"),
      orgId,
      updates as object as Parameters<typeof updatePRDraft>[2],
      userId,
      {
        isAutoSave: true,
      }
    );
    return res.json({ success: true, lastSavedAt: pr?.lastDraftSaveAt });
  } catch (error) {
    logger.error("[Purchasing] Error auto-saving PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── POST /purchase-requests/:id/items ─────────────────────────────────────────
prRouter.post("/purchase-requests/:id/items", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const { partId, supplierId, quantity, uom, remarks } = req.body;
    if (!partId || quantity === undefined) {
      return res.status(400).json({ error: "partId and quantity are required" });
    }

    // Improvement #9: result now includes substitution suggestions when out of stock
    const result = await service.addItemToPR(
      pathParam(req, "id"),
      orgId,
      { partId, supplierId, quantity, uom, remarks },
      userId
    );

    return res.status(201).json(result);
  } catch (error) {
    logger.error("[Purchasing] Error adding item to PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── DELETE /purchase-requests/:id/items/:itemId ────────────────────────────────
prRouter.delete("/purchase-requests/:id/items/:itemId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const removed = await service.removeItemFromPR(
      pathParam(req, "id"),
      pathParam(req, "itemId"),
      orgId,
      userId
    );

    if (!removed) {
      return res.status(404).json({ error: "Item not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    logger.error("[Purchasing] Error removing item from PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── POST /purchase-requests/:id/send ─────────────────────────────────────────
prRouter.post("/purchase-requests/:id/send", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const result = await service.sendPR(pathParam(req, "id"), orgId, userId);
    return res.json(result);
  } catch (error) {
    logger.error("[Purchasing] Error sending PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── POST /purchase-requests/:id/cancel ────────────────────────────────────────
prRouter.post("/purchase-requests/:id/cancel", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const pr = await service.cancelPR(pathParam(req, "id"), orgId, userId);
    return res.json(pr);
  } catch (error) {
    logger.error("[Purchasing] Error cancelling PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── POST /purchase-requests/:id/close ─────────────────────────────────────────
prRouter.post("/purchase-requests/:id/close", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const pr = await service.closePR(pathParam(req, "id"), orgId, userId);
    return res.json(pr);
  } catch (error) {
    logger.error("[Purchasing] Error closing PR:", undefined, error);
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
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
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    // Improvement #18: single fetch — no join needed for status + permission check
    const { getPurchaseRequestById } = await import("./repository");
    const existingPR = await getPurchaseRequestById(pathParam(req, "id"), orgId);
    if (!existingPR) {
      return res.status(404).json({ error: "Purchase request not found" });
    }

    if (userId) {
      const permCheck = await canModifyRecord(
        userId,
        orgId,
        existingPR.status,
        PR_PERMISSION_GUARD
      );
      if (!permCheck.allowed) {
        return res.status(403).json({
          error: "Forbidden",
          message: permCheck.reason,
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    }

    const status = existingPR.status as PRStatus;
    if (status !== "draft" && status !== "cancelled") {
      return res.status(400).json({ error: "Only draft or cancelled requests can be deleted" });
    }

    // Delete in FK order: events → items → PR
    await db
      .delete(purchaseRequestEvents)
      .where(
        and(
          eq(purchaseRequestEvents.prId, pathParam(req, "id")),
          eq(purchaseRequestEvents.orgId, orgId)
        )
      );
    await db
      .delete(purchaseRequestItems)
      .where(
        and(
          eq(purchaseRequestItems.prId, pathParam(req, "id")),
          eq(purchaseRequestItems.orgId, orgId)
        )
      );
    await db
      .delete(purchaseRequests)
      .where(and(eq(purchaseRequests.id, pathParam(req, "id")), eq(purchaseRequests.orgId, orgId)));

    return res.json({ success: true });
  } catch (error) {
    logger.error("[Purchasing] Error deleting PR:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── PATCH /purchase-requests/:id/status ───────────────────────────────────────
prRouter.patch("/purchase-requests/:id/status", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const userId = req.headers["x-user-id"] as string | undefined;

    const { status: newStatus } = req.body;
    if (!newStatus) {
      return res.status(400).json({ error: "status is required" });
    }

    const { updatePRStatus } = await import("./fulfillment-service");
    const result = await updatePRStatus(pathParam(req, "id"), orgId, newStatus, userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result.pr);
  } catch (error) {
    logger.error("[Purchasing] Error updating PR status:", undefined, error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ── POST /purchase-requests/:id/items/:itemId/fulfill ─────────────────────────
prRouter.post(
  "/purchase-requests/:id/items/:itemId/fulfill",
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const userId = req.headers["x-user-id"] as string | undefined;

      const { quantityToFulfill } = req.body;
      if (quantityToFulfill === undefined || quantityToFulfill <= 0) {
        return res.status(400).json({ error: "quantityToFulfill must be a positive number" });
      }

      const { fulfillItem } = await import("./fulfillment-service");
      const result = await fulfillItem({
        prId: pathParam(req, "id"),
        itemId: pathParam(req, "itemId"),
        orgId,
        quantityToFulfill,
        fulfilledBy: userId || "system",
      });

      return res.json(result);
    } catch (error) {
      logger.error("[Purchasing] Error fulfilling item:", undefined, error);
      return res
        .status(400)
        .json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ── DELETE /purchase-requests/bulk/by-work-order/:workOrderId ─────────────────
prRouter.delete(
  "/purchase-requests/bulk/by-work-order/:workOrderId",
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;

      const { deleteAllPurchaseRequestsByWorkOrder } = await import("./fulfillment-service");
      const result = await deleteAllPurchaseRequestsByWorkOrder(
        pathParam(req, "workOrderId"),
        orgId
      );
      return res.json(result);
    } catch (error) {
      logger.error("[Purchasing] Error bulk deleting PRs:", undefined, error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);
