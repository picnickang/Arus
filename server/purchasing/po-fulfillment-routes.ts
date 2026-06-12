import type { RequestHandler, Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { createLogger } from "../lib/structured-logger";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderEvents,
  purchaseRequestItems,
} from "@shared/schema";
import { authenticatedRequest, requireOrgId, type AuthenticatedRequest } from "../middleware/auth";
import { idempotencyMiddleware } from "../middleware/idempotency";
import { fulfillItem } from "./fulfillment-service";

const logger = createLogger("Purchasing:PoRoutes");

interface PurchaseOrderFulfillmentRouteLimits {
  generalLimit: RequestHandler;
  writeLimit: RequestHandler;
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.orgId as string;
}

export function registerPurchaseOrderFulfillmentRoutes(
  router: Router,
  { generalLimit, writeLimit }: PurchaseOrderFulfillmentRouteLimits
): void {
  // POST /purchase-orders/:id/fulfill-pr - Improvement #10
  /**
   * Connect PO receipt to the originating PR fulfillment in one operation.
   * When a PO is received, this endpoint finds the linked PR and triggers
   * fulfillItem for each received item, decrementing inventory atomically.
   *
   * This closes the loop: Receive PO, PR items marked fulfilled, inventory decremented.
   */
  // LR-3.5 / TX-2: /fulfill-pr is the highest-stakes PO mutation: it
  // iterates received PO items and calls fulfillItem() which decrements
  // parts inventory. A retried POST without an idempotency key would
  // double-decrement inventory (the fulfilledQuantity guard caps total
  // fulfilled at the PR line quantity, so the second call lands at
  // quantityToFulfill=0 today, but that's a defence-in-depth invariant
  // inside fulfillItem, not a contract of this route). Cache the original
  // response so flaky-network retries return the same per-item result set.
  router.post(
    "/:id/fulfill-pr",
    requireOrgId,
    idempotencyMiddleware(),
    writeLimit,
    async (req, res) => {
      try {
        const orgId = getOrgId(req);
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ error: "Missing required path parameter: id" });
        }
        const userId = authenticatedRequest(req).user?.id;

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

        const prId = (creationEvent?.details as { prId?: string } | undefined)?.prId;
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

        return res.json({ success: true, prId, results });
      } catch (err) {
        logger.error("Error fulfilling PR from PO:", undefined, err);
        return res.status(500).json({ error: "Failed to fulfill PR" });
      }
    }
  );

  // GET /purchase-orders/:id/events
  router.get("/:id/events", requireOrgId, generalLimit, async (req, res) => {
    try {
      const orgId = getOrgId(req);
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "Missing required path parameter: id" });
      }

      const events = await db
        .select()
        .from(purchaseOrderEvents)
        .where(and(eq(purchaseOrderEvents.poId, id), eq(purchaseOrderEvents.orgId, orgId)))
        .orderBy(sql`${purchaseOrderEvents.createdAt} DESC`);

      return res.json(events);
    } catch (err) {
      logger.error("Error getting PO events:", undefined, err);
      return res.status(500).json({ error: "Failed to get events" });
    }
  });
}
