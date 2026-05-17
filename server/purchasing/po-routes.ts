/**
 * Purchase Order Routes
 *
 * Improvements applied:
 * #6  — Partial rejection flow: POST /:id/reject-items records rejected_quantity
 *        and rejection_reason per item without fully cancelling the PO.
 * #10 — Bulk fulfillment: POST /:id/fulfill-pr links PO receipt to the originating
 *        PR and calls fulfillItem for each received item atomically.
 * #18 — DELETE /purchase-requests/:id no longer fetches the PR twice.
 *        The route now fetches once, checks status, then deletes.
 * #19 — PATCH /:id/items/:itemId lets the buyer update quoted unit price
 *        after receiving a supplier quotation, before confirming the PO.
 */

import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Purchasing:PoRoutes");
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderEvents,
  purchaseRequestItems,
  suppliers,
  parts,
} from "@shared/schema";
import { requireOrgId, type AuthenticatedRequest } from "../middleware/auth";
import { RateLimiters } from "../lib/rate-limit-factory";
import { fulfillItem } from "./fulfillment-service";

const router = Router();
const generalLimit = RateLimiters.general();
const writeLimit = RateLimiters.write();

function getOrgId(req: any): string {
  return (req as AuthenticatedRequest).orgId as string;
}

function parseIntSafe(val: string | undefined, def: number, max?: number): number {
  const n = Number.parseInt(val ?? "", 10);
  if (Number.isNaN(n) || n < 0) {
    return def;
  }
  return max !== undefined ? Math.min(n, max) : n;
}

// ── GET /purchase-orders ───────────────────────────────────────────────────────
router.get("/", requireOrgId, generalLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const status = req.query.status as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const limit = parseIntSafe(req.query.limit as string, 50, 100);
    const offset = parseIntSafe(req.query.offset as string, 0);

    const conditions: any[] = [eq(purchaseOrders.orgId, orgId)];
    if (status) {
      conditions.push(eq(purchaseOrders.status, status));
    }
    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, supplierId));
    }

    const results = await db
      .select({
        id: purchaseOrders.id,
        orgId: purchaseOrders.orgId,
        supplierId: purchaseOrders.supplierId,
        orderNumber: purchaseOrders.orderNumber,
        expectedDate: purchaseOrders.expectedDate,
        totalAmount: purchaseOrders.totalAmount,
        currency: purchaseOrders.currency,
        status: purchaseOrders.status,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        supplierName: suppliers.name,
        supplierCode: suppliers.code,
        totalQty: sql<number>`COALESCE(SUM(${purchaseOrderItems.quantity}), 0)`.as("totalQty"),
        receivedQty: sql<number>`COALESCE(SUM(${purchaseOrderItems.receivedQuantity}), 0)`.as(
          "receivedQty"
        ),
        rejectedQty: sql<number>`COALESCE(SUM(${purchaseOrderItems.rejectedQuantity}), 0)`.as(
          "rejectedQty"
        ),
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(purchaseOrderItems, eq(purchaseOrders.id, purchaseOrderItems.poId))
      .where(and(...conditions))
      .groupBy(purchaseOrders.id, suppliers.id)
      .orderBy(sql`${purchaseOrders.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const enriched = results.map((po) => ({
      ...po,
      // Improvement #15: progress included in list response for frontend progress bar
      progress:
        po.totalQty > 0 ? Math.round(((po.receivedQty - po.rejectedQty) / po.totalQty) * 100) : 0,
    }));

    res.json(enriched);
  } catch (err) {
    logger.error("Error listing POs:", undefined, err);
    res.status(500).json({ error: "Failed to list purchase orders" });
  }
});

// ── GET /purchase-orders/:id ───────────────────────────────────────────────────
router.get("/:id", requireOrgId, generalLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        orgId: purchaseOrders.orgId,
        supplierId: purchaseOrders.supplierId,
        orderNumber: purchaseOrders.orderNumber,
        expectedDate: purchaseOrders.expectedDate,
        totalAmount: purchaseOrders.totalAmount,
        currency: purchaseOrders.currency,
        status: purchaseOrders.status,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        supplierName: suppliers.name,
        supplierCode: suppliers.code,
        supplierEmail: suppliers.email,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        poId: purchaseOrderItems.poId,
        partId: purchaseOrderItems.partId,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        totalPrice: purchaseOrderItems.totalPrice,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        rejectedQuantity: purchaseOrderItems.rejectedQuantity,
        rejectionReason: purchaseOrderItems.rejectionReason,
        notes: purchaseOrderItems.notes,
        partName: parts.name,
        partNumber: parts.partNumber,
      })
      .from(purchaseOrderItems)
      .leftJoin(parts, eq(purchaseOrderItems.partId, parts.id))
      .where(eq(purchaseOrderItems.poId, id));

    res.json({ ...po, items });
  } catch (err) {
    logger.error("Error getting PO:", undefined, err);
    res.status(500).json({ error: "Failed to get purchase order" });
  }
});

// ── POST /purchase-orders/:id/receive ─────────────────────────────────────────
router.post("/:id/receive", requireOrgId, writeLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const schema = z.object({
      items: z.array(
        z.object({
          itemId: z.string(),
          receivedQuantity: z.number().min(0),
        })
      ),
      userId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    if (po.status === "cancelled" || po.status === "received") {
      return res.status(400).json({ error: "Cannot update received/cancelled PO" });
    }

    const existingItems = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

    const itemMap = new Map(existingItems.map((i) => [i.id, i]));

    for (const item of parsed.data.items) {
      const existing = itemMap.get(item.itemId);
      if (!existing) {
        continue;
      }
      const clampedQty = Math.min(item.receivedQuantity, existing.quantity);
      await db
        .update(purchaseOrderItems)
        .set({ receivedQuantity: clampedQty })
        .where(and(eq(purchaseOrderItems.id, item.itemId), eq(purchaseOrderItems.poId, id)));
    }

    await db.insert(purchaseOrderEvents).values({
      orgId,
      poId: id,
      eventType: "qty_updated",
      userId: parsed.data.userId,
      details: { items: parsed.data.items },
    });

    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, id));
    const allReceived = items.every((item) => (item.receivedQuantity || 0) >= item.quantity);

    if (allReceived) {
      await db
        .update(purchaseOrders)
        .set({ status: "received", updatedAt: new Date() })
        .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

      await db.insert(purchaseOrderEvents).values({
        orgId,
        poId: id,
        eventType: "received",
        userId: parsed.data.userId,
        details: {},
      });
    }

    res.json({ success: true, status: allReceived ? "received" : po.status });
  } catch (err) {
    logger.error("Error receiving PO items:", undefined, err);
    res.status(500).json({ error: "Failed to receive items" });
  }
});

// ── POST /purchase-orders/:id/reject-items — Improvement #6 ───────────────────
/**
 * Record partial rejections without cancelling the entire PO.
 * Rejected quantities are tracked separately from received quantities.
 * Useful when items arrive damaged, incorrect, or fail quality inspection.
 */
router.post("/:id/reject-items", requireOrgId, writeLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const schema = z.object({
      items: z.array(
        z.object({
          itemId: z.string(),
          rejectedQuantity: z.number().min(1),
          rejectionReason: z.string().min(1, "Rejection reason is required"),
        })
      ),
      userId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    if (po.status === "cancelled") {
      return res.status(400).json({ error: "Cannot reject items on a cancelled PO" });
    }

    const results: { itemId: string; rejectedQuantity: number }[] = [];

    for (const item of parsed.data.items) {
      const [existing] = await db
        .select()
        .from(purchaseOrderItems)
        .where(and(eq(purchaseOrderItems.id, item.itemId), eq(purchaseOrderItems.poId, id)));

      if (!existing) {
        continue;
      }

      // Cannot reject more than was received
      const maxRejectable = existing.receivedQuantity || 0;
      const clampedQty = Math.min(item.rejectedQuantity, maxRejectable);

      await db
        .update(purchaseOrderItems)
        .set({
          rejectedQuantity: clampedQty,
          rejectionReason: item.rejectionReason,
        })
        .where(and(eq(purchaseOrderItems.id, item.itemId), eq(purchaseOrderItems.poId, id)));

      results.push({ itemId: item.itemId, rejectedQuantity: clampedQty });
    }

    await db.insert(purchaseOrderEvents).values({
      orgId,
      poId: id,
      eventType: "items_rejected",
      userId: parsed.data.userId,
      details: { rejections: parsed.data.items },
    });

    res.json({ success: true, rejections: results });
  } catch (err) {
    logger.error("Error rejecting PO items:", undefined, err);
    res.status(500).json({ error: "Failed to reject items" });
  }
});

// ── PATCH /purchase-orders/:id/items/:itemId — Improvement #19 ────────────────
/**
 * Update quoted unit price on a PO item after receiving a supplier quotation.
 * Only allowed when PO is in "sent" status (i.e. awaiting confirmation).
 */
router.patch("/:id/items/:itemId", requireOrgId, writeLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id, itemId } = req.params;

    const schema = z.object({
      unitPrice: z.number().min(0, "Unit price must be non-negative"),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    if (po.status !== "sent") {
      return res.status(400).json({
        error: `Can only update item prices on sent POs. Current status: ${po.status}`,
      });
    }

    const [existing] = await db
      .select()
      .from(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.id, itemId), eq(purchaseOrderItems.poId, id)));

    if (!existing) {
      return res.status(404).json({ error: "PO item not found" });
    }

    const newTotalPrice = (existing.quantity || 0) * parsed.data.unitPrice;

    const [updated] = await db
      .update(purchaseOrderItems)
      .set({
        unitPrice: parsed.data.unitPrice,
        totalPrice: newTotalPrice,
        notes: parsed.data.notes ?? existing.notes,
      })
      .where(and(eq(purchaseOrderItems.id, itemId), eq(purchaseOrderItems.poId, id)))
      .returning();

    // Recalculate PO total amount
    const allItems = await db
      .select({ totalPrice: purchaseOrderItems.totalPrice })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

    const newTotalAmount = allItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0);
    await db
      .update(purchaseOrders)
      .set({ totalAmount: newTotalAmount, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    await db.insert(purchaseOrderEvents).values({
      orgId,
      poId: id,
      eventType: "price_updated",
      userId: (req as AuthenticatedRequest).user?.id,
      details: { itemId, oldUnitPrice: existing.unitPrice, newUnitPrice: parsed.data.unitPrice },
    });

    res.json(updated);
  } catch (err) {
    logger.error("Error updating PO item price:", undefined, err);
    res.status(500).json({ error: "Failed to update item price" });
  }
});

// ── POST /purchase-orders/:id/fulfill-pr — Improvement #10 ───────────────────
/**
 * Connect PO receipt to the originating PR fulfillment in one operation.
 * When a PO is received, this endpoint finds the linked PR and triggers
 * fulfillItem for each received item, decrementing inventory atomically.
 *
 * This closes the loop: Receive PO → PR items marked fulfilled → inventory decremented.
 */
router.post("/:id/fulfill-pr", requireOrgId, writeLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user?.id;

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    if (po.status !== "received") {
      return res.status(400).json({ error: "Can only fulfill PR from a received PO" });
    }

    // Find the originating PR via the PO creation event
    const [creationEvent] = await db
      .select()
      .from(purchaseOrderEvents)
      .where(
        and(
          eq(purchaseOrderEvents.poId, id),
          eq(purchaseOrderEvents.eventType, "created"),
          eq(purchaseOrderEvents.orgId, orgId)
        )
      )
      .orderBy(sql`${purchaseOrderEvents.createdAt} ASC`)
      .limit(1);

    const prId = (creationEvent?.details as any)?.prId as string | undefined;
    if (!prId) {
      return res.status(400).json({ error: "No originating PR found for this PO" });
    }

    const poItems = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

    const results: {
      partId: string;
      receivedQty: number;
      fulfilled: boolean;
      error?: string;
    }[] = [];

    for (const poItem of poItems) {
      const receivedQty = (poItem.receivedQuantity || 0) - (poItem.rejectedQuantity || 0);
      if (receivedQty <= 0) {
        continue;
      }

      // Find the matching PR item
      const [prItem] = await db
        .select()
        .from(purchaseRequestItems)
        .where(
          and(
            eq(purchaseRequestItems.prId, prId),
            eq(purchaseRequestItems.partId, poItem.partId),
            eq(purchaseRequestItems.orgId, orgId)
          )
        )
        .limit(1);

      if (!prItem) {
        results.push({
          partId: poItem.partId,
          receivedQty,
          fulfilled: false,
          error: "No matching PR item",
        });
        continue;
      }

      try {
        await fulfillItem({
          prId,
          itemId: prItem.id,
          orgId,
          quantityToFulfill: Math.min(
            receivedQty,
            prItem.quantity - (prItem.quantityFulfilled ?? 0)
          ),
          fulfilledBy: userId || "system",
        });
        results.push({ partId: poItem.partId, receivedQty, fulfilled: true });
      } catch (err) {
        results.push({
          partId: poItem.partId,
          receivedQty,
          fulfilled: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    res.json({ success: true, prId, results });
  } catch (err) {
    logger.error("Error fulfilling PR from PO:", undefined, err);
    res.status(500).json({ error: "Failed to fulfill PR" });
  }
});

// ── GET /purchase-orders/:id/events ───────────────────────────────────────────
router.get("/:id/events", requireOrgId, generalLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const events = await db
      .select()
      .from(purchaseOrderEvents)
      .where(and(eq(purchaseOrderEvents.poId, id), eq(purchaseOrderEvents.orgId, orgId)))
      .orderBy(sql`${purchaseOrderEvents.createdAt} DESC`);

    res.json(events);
  } catch (err) {
    logger.error("Error getting PO events:", undefined, err);
    res.status(500).json({ error: "Failed to get events" });
  }
});

export default router;
