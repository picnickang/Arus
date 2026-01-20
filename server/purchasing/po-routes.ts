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

const router = Router();

router.get("/", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 50, 100);
    const offset = Number.parseInt(req.query.offset as string) || 0;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) {conditions.push(eq(purchaseOrders.status, status));}
    if (supplierId) {conditions.push(eq(purchaseOrders.supplierId, supplierId));}

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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(purchaseOrders.id, suppliers.id)
      .orderBy(sql`${purchaseOrders.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const enriched = results.map((po) => ({
      ...po,
      progress: po.totalQty > 0 ? Math.round((po.receivedQty / po.totalQty) * 100) : 0,
    }));

    res.json(enriched);
  } catch (_err) {
    console.error("Error listing POs:", err);
    res.status(500).json({ error: "Failed to list purchase orders" });
  }
});

router.get("/:id", async (req, res) => {
  try {
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
      .where(eq(purchaseOrders.id, id));

    if (!po) {return res.status(404).json({ error: "Purchase order not found" });}

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
  } catch (_err) {
    console.error("Error getting PO:", err);
    res.status(500).json({ error: "Failed to get purchase order" });
  }
});

router.post("/:id/receive", async (req, res) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      items: z.array(z.object({
        itemId: z.string(),
        receivedQuantity: z.number().min(0),
      })),
      userId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {return res.status(400).json({ error: parsed.error.message });}

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));

    if (!po) {return res.status(404).json({ error: "Purchase order not found" });}
    if (po.status === "cancelled" || po.status === "received") {
      return res.status(400).json({ error: "Cannot update received/cancelled PO" });
    }

    const existingItems = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

    const itemMap = new Map(existingItems.map(i => [i.id, i]));

    for (const item of parsed.data.items) {
      const existing = itemMap.get(item.itemId);
      if (!existing) {continue;}
      
      const clampedQty = Math.min(item.receivedQuantity, existing.quantity);
      await db
        .update(purchaseOrderItems)
        .set({ receivedQuantity: clampedQty })
        .where(and(eq(purchaseOrderItems.id, item.itemId), eq(purchaseOrderItems.poId, id)));
    }

    await db.insert(purchaseOrderEvents).values({
      orgId: "default-org",
      poId: id,
      eventType: "qty_updated",
      userId: parsed.data.userId,
      details: { items: parsed.data.items },
    });

    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, id));

    const allReceived = items.every((item) => 
      (item.receivedQuantity || 0) >= item.quantity
    );

    if (allReceived) {
      await db
        .update(purchaseOrders)
        .set({ status: "received", updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));

      await db.insert(purchaseOrderEvents).values({
        orgId: "default-org",
        poId: id,
        eventType: "received",
        userId: parsed.data.userId,
        details: {},
      });
    }

    res.json({ success: true, status: allReceived ? "received" : po.status });
  } catch (_err) {
    console.error("Error receiving PO items:", err);
    res.status(500).json({ error: "Failed to receive items" });
  }
});

router.get("/:id/events", async (req, res) => {
  try {
    const { id } = req.params;

    const events = await db
      .select()
      .from(purchaseOrderEvents)
      .where(eq(purchaseOrderEvents.poId, id))
      .orderBy(sql`${purchaseOrderEvents.createdAt} DESC`);

    res.json(events);
  } catch (_err) {
    console.error("Error getting PO events:", err);
    res.status(500).json({ error: "Failed to get events" });
  }
});

export default router;
