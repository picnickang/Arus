/**
 * Purchase Order Routes
 * API endpoints for PO management
 */

import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderEvents,
  suppliers,
  parts,
} from "@shared/schema";
import { requireOrgId, type AuthenticatedRequest } from "../middleware/auth";
import { createRateLimiter } from "../lib/rate-limit-factory";

const router = Router();

const generalLimit = createRateLimiter("general");
const writeLimit = createRateLimiter("write");

function getOrgId(req: Parameters<typeof requireOrgId>[0]): string {
  return (req as AuthenticatedRequest).orgId as string;
}

function parsePaginationParam(value: string | undefined, defaultVal: number, max?: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 0) return defaultVal;
  return max !== undefined ? Math.min(parsed, max) : parsed;
}

router.get("/", requireOrgId, generalLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const status = req.query.status as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const limit = parsePaginationParam(req.query.limit as string, 50, 100);
    const offset = parsePaginationParam(req.query.offset as string, 0);

    const conditions: ReturnType<typeof eq>[] = [eq(purchaseOrders.orgId, orgId)];
    if (status) { conditions.push(eq(purchaseOrders.status, status)); }
    if (supplierId) { conditions.push(eq(purchaseOrders.supplierId, supplierId)); }

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
        receivedQty: sql<number>`COALESCE(SUM(${purchaseOrderItems.receivedQuantity}), 0)`.as("receivedQty"),
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
      progress: po.totalQty > 0 ? Math.round((po.receivedQty / po.totalQty) * 100) : 0,
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Error listing POs:", err);
    res.status(500).json({ error: "Failed to list purchase orders" });
  }
});

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

    if (!po) { return res.status(404).json({ error: "Purchase order not found" }); }

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        poId: purchaseOrderItems.poId,
        partId: purchaseOrderItems.partId,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        totalPrice: purchaseOrderItems.totalPrice,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        notes: purchaseOrderItems.notes,
        partName: parts.name,
        partNumber: parts.partNumber,
      })
      .from(purchaseOrderItems)
      .leftJoin(parts, eq(purchaseOrderItems.partId, parts.id))
      .where(eq(purchaseOrderItems.poId, id));

    res.json({ ...po, items });
  } catch (err) {
    console.error("Error getting PO:", err);
    res.status(500).json({ error: "Failed to get purchase order" });
  }
});

router.post("/:id/receive", requireOrgId, writeLimit, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const schema = z.object({
      items: z.array(z.object({
        itemId: z.string(),
        receivedQuantity: z.number().min(0),
      })),
      userId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { return res.status(400).json({ error: parsed.error.message }); }

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.orgId, orgId)));

    if (!po) { return res.status(404).json({ error: "Purchase order not found" }); }
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
      if (!existing) { continue; }
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

    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

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
    console.error("Error receiving PO items:", err);
    res.status(500).json({ error: "Failed to receive items" });
  }
});

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
    console.error("Error getting PO events:", err);
    res.status(500).json({ error: "Failed to get events" });
  }
});

export default router;
