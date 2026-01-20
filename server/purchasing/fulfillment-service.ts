/**
 * Fulfillment Service
 * Handles parts request fulfillment with inventory decrement
 * Max 250 lines - modular design
 */

import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { purchaseRequestItems, purchaseRequests, purchaseRequestEvents, partsInventory } from "@shared/schema";
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
  const [item] = await db
    .select()
    .from(partsInventory)
    .where(
      and(
        eq(partsInventory.partId, partId),
        eq(partsInventory.orgId, orgId)
      )
    );
  return item;
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

    const [inventoryItem] = await tx
      .select()
      .from(partsInventory)
      .where(
        and(
          eq(partsInventory.partId, prItem.partId),
          eq(partsInventory.orgId, orgId)
        )
      )
      .for("update");

    if (inventoryItem) {
      const currentStock = inventoryItem.quantityOnHand ?? 0;
      if (currentStock < quantityToFulfill) {
        throw new Error(
          `Insufficient stock. Available: ${currentStock}, Requested: ${quantityToFulfill}`
        );
      }
      newStockLevel = currentStock - quantityToFulfill;

      await tx
        .update(partsInventory)
        .set({ quantityOnHand: newStockLevel, updatedAt: new Date() })
        .where(eq(partsInventory.id, inventoryItem.id));
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
  });

  if (inventoryUpdated && newStockLevel !== undefined) {
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
  }

  await repository.createPREvent(orgId, prId, "item_fulfilled", fulfilledBy, {
    itemId,
    partId,
    quantityFulfilled: quantityToFulfill,
    totalFulfilled: newFulfilled,
    fulfillmentStatus,
    inventoryUpdated,
    newStockLevel,
  });

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
): Promise<{ success: boolean; pr?: any; error?: string }> {
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

  const updatedPR = await repository.updatePurchaseRequest(prId, orgId, updateData as any);

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
    .where(
      and(
        eq(purchaseRequestItems.prId, prId),
        eq(purchaseRequestItems.orgId, orgId)
      )
    );

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

  // Delete events first (FK constraint)
  await db
    .delete(purchaseRequestEvents)
    .where(
      and(
        eq(purchaseRequestEvents.prId, prId),
        eq(purchaseRequestEvents.orgId, orgId)
      )
    );

  // Then delete items
  await db
    .delete(purchaseRequestItems)
    .where(
      and(
        eq(purchaseRequestItems.prId, prId),
        eq(purchaseRequestItems.orgId, orgId)
      )
    );

  // Finally delete the PR
  await db
    .delete(purchaseRequests)
    .where(
      and(
        eq(purchaseRequests.id, prId),
        eq(purchaseRequests.orgId, orgId)
      )
    );

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
