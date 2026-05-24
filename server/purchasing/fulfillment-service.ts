/**
 * Fulfillment Service
 * Handles parts request fulfillment with inventory decrement
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Purchasing:FulfillmentService");
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  purchaseRequestItems,
  purchaseRequests,
  purchaseRequestEvents,
  stock,
} from "@shared/schema";
import type { FulfillItemRequest, FulfillmentResult, FulfillmentStatus, PRStatus } from "./types";
import * as repository from "./repository";
import { recordAndPublish } from "../sync-events";

const VALID_STATUS_TRANSITIONS: Record<PRStatus, PRStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
  received: ["closed"],
  closed: [],
  cancelled: [],
};

export async function getPRItemById(itemId: string, prId: string, orgId: string) {
  const [item] = await db
    .select()
    .from(purchaseRequestItems)
    .where(
      and(
        eq(purchaseRequestItems.id, itemId),
        eq(purchaseRequestItems.prId, prId),
        eq(purchaseRequestItems.orgId, orgId)
      )
    );
  return item;
}

export async function updatePRItemFulfillment(
  itemId: string,
  prId: string,
  orgId: string,
  data: {
    quantityFulfilled: number;
    fulfillmentStatus: FulfillmentStatus;
    fulfilledAt?: Date;
    fulfilledBy?: string;
  }
) {
  const [result] = await db
    .update(purchaseRequestItems)
    .set(data)
    .where(
      and(
        eq(purchaseRequestItems.id, itemId),
        eq(purchaseRequestItems.prId, prId),
        eq(purchaseRequestItems.orgId, orgId)
      )
    )
    .returning();
  return result;
}

export async function getInventoryByPartId(partId: string, orgId: string) {
  const stockRows = await db
    .select()
    .from(stock)
    .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)));
  if (stockRows.length === 0) {
    return null;
  }
  return {
    ...stockRows[0],
    quantityOnHand: stockRows.reduce((s, r) => s + (r.quantityOnHand ?? 0), 0),
    quantityReserved: stockRows.reduce((s, r) => s + (r.quantityReserved ?? 0), 0),
  };
}

export async function fulfillItem(request: FulfillItemRequest): Promise<FulfillmentResult> {
  const { prId, itemId, orgId, quantityToFulfill, fulfilledBy } = request;

  let newStockLevel: number | undefined;
  let inventoryUpdated = false;
  let newFulfilled = 0;
  let fulfillmentStatus: FulfillmentStatus = "pending";
  let partId = "";

  await db.transaction(async (tx) => {
    const [prItem] = await tx
      .select()
      .from(purchaseRequestItems)
      .where(
        and(
          eq(purchaseRequestItems.id, itemId),
          eq(purchaseRequestItems.prId, prId),
          eq(purchaseRequestItems.orgId, orgId)
        )
      )
      .for("update");

    if (!prItem) {
      throw new Error(`Purchase request item ${itemId} not found`);
    }

    partId = prItem.partId;
    const currentFulfilled = prItem.quantityFulfilled ?? 0;
    newFulfilled = currentFulfilled + quantityToFulfill;
    const requestedQty = prItem.quantity;

    if (newFulfilled > requestedQty) {
      throw new Error(
        `Cannot fulfill ${quantityToFulfill} units. Only ${requestedQty - currentFulfilled} remaining.`
      );
    }

    if (newFulfilled >= requestedQty) {
      fulfillmentStatus = "fulfilled";
    } else if (newFulfilled > 0) {
      fulfillmentStatus = "partial";
    }

    const stockItems = await tx
      .select()
      .from(stock)
      .where(and(eq(stock.partId, prItem.partId), eq(stock.orgId, orgId)))
      .orderBy(sql`${stock.quantityOnHand} DESC`)
      .for("update");

    if (stockItems.length > 0) {
      const totalOnHand = stockItems.reduce((s, r) => s + Math.round(r.quantityOnHand ?? 0), 0);
      if (totalOnHand < quantityToFulfill) {
        throw new Error(
          `Insufficient stock. Available: ${totalOnHand}, Requested: ${quantityToFulfill}`
        );
      }
      let remaining = quantityToFulfill;
      for (const row of stockItems) {
        if (remaining <= 0) {
          break;
        }
        const onHand = Math.round(row.quantityOnHand ?? 0);
        const toDeduct = Math.min(remaining, onHand);
        if (toDeduct > 0) {
          await tx
            .update(stock)
            .set({ quantityOnHand: onHand - toDeduct, updatedAt: new Date() })
            .where(eq(stock.id, row.id));
          remaining -= toDeduct;
        }
      }
      newStockLevel = totalOnHand - quantityToFulfill;
      inventoryUpdated = true;
    }

    await tx
      .update(purchaseRequestItems)
      .set({
        quantityFulfilled: newFulfilled,
        fulfillmentStatus,
        fulfilledAt: fulfillmentStatus === "fulfilled" ? new Date() : undefined,
        fulfilledBy,
      })
      .where(eq(purchaseRequestItems.id, itemId));

    await tx.insert(purchaseRequestEvents).values({
      orgId,
      prId,
      eventType: "item_fulfilled",
      userId: fulfilledBy,
      details: {
        itemId,
        partId,
        quantityFulfilled: quantityToFulfill,
        totalFulfilled: newFulfilled,
        fulfillmentStatus,
        inventoryUpdated,
        newStockLevel,
      },
    });
  });

  if (inventoryUpdated && newStockLevel !== undefined) {
    try {
      await recordAndPublish(
        "parts_inventory",
        partId,
        "update",
        {
          partId,
          orgId,
          action: "fulfillment_decrement",
          quantityDeducted: quantityToFulfill,
          newStockLevel,
          prId,
          itemId,
        },
        fulfilledBy
      );
    } catch (publishErr) {
      logger.error("[fulfillItem] recordAndPublish failed (non-fatal):", undefined, publishErr);
    }
  }

  return {
    itemId,
    partId,
    quantityFulfilled: newFulfilled,
    fulfillmentStatus,
    inventoryUpdated,
    newStockLevel,
  };
}

export function validateStatusTransition(currentStatus: PRStatus, newStatus: PRStatus): boolean {
  const validNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return validNextStatuses.includes(newStatus);
}

export async function updatePRStatus(
  prId: string,
  orgId: string,
  newStatus: PRStatus,
  userId?: string
): Promise<{ success: boolean; pr?: Awaited<ReturnType<typeof repository.getPurchaseRequestById>>; error?: string }> {
  const pr = await repository.getPurchaseRequestById(prId, orgId);
  if (!pr) {
    return { success: false, error: "Purchase request not found" };
  }

  const currentStatus = pr.status as PRStatus;
  if (!validateStatusTransition(currentStatus, newStatus)) {
    return {
      success: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
    };
  }

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "closed") {
    updateData.closedAt = new Date();
  }

  const updatedPR = await repository.updatePurchaseRequest(prId, orgId, updateData as object as Parameters<typeof repository.updatePurchaseRequest>[2]);

  await repository.createPREvent(orgId, prId, newStatus, userId, {
    previousStatus: currentStatus,
    newStatus,
  });

  return { success: true, pr: updatedPR };
}

export async function checkAllItemsFulfilled(prId: string, orgId: string): Promise<boolean> {
  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      fulfilled: sql<number>`COUNT(*) FILTER (WHERE fulfillment_status = 'fulfilled')`,
    })
    .from(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.prId, prId), eq(purchaseRequestItems.orgId, orgId)));

  const { total, fulfilled } = result[0] || { total: 0, fulfilled: 0 };
  return total > 0 && total === fulfilled;
}

export async function deletePurchaseRequest(
  prId: string,
  orgId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const pr = await repository.getPurchaseRequestById(prId, orgId);
  if (!pr) {
    return { success: false, error: "Purchase request not found" };
  }

  const status = pr.status as PRStatus;
  if (status !== "draft" && status !== "cancelled") {
    return { success: false, error: "Only draft or cancelled requests can be deleted" };
  }

  await db
    .delete(purchaseRequestEvents)
    .where(and(eq(purchaseRequestEvents.prId, prId), eq(purchaseRequestEvents.orgId, orgId)));
  await db
    .delete(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.prId, prId), eq(purchaseRequestItems.orgId, orgId)));
  await db
    .delete(purchaseRequests)
    .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.orgId, orgId)));

  return { success: true };
}

export async function deleteAllPurchaseRequestsByWorkOrder(
  workOrderId: string,
  orgId: string
): Promise<{ success: boolean; deletedCount: number; skippedCount: number; errors: string[] }> {
  const prs = await repository.listPurchaseRequests({ orgId, workOrderId });
  let deletedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const pr of prs) {
    const result = await deletePurchaseRequest(pr.id, orgId);
    if (result.success) {
      deletedCount++;
    } else {
      skippedCount++;
      if (result.error) {
        errors.push(`${pr.requestNumber}: ${result.error}`);
      }
    }
  }

  return { success: true, deletedCount, skippedCount, errors };
}
