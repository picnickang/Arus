/**
 * PR Draft Service
 * Creation and modification of draft purchase requests
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { parts, suppliers } from "@shared/schema";
import * as repo from "./repository";
import type {
  InsertPurchaseRequest,
  InsertPurchaseRequestItem,
  PRListFilters,
} from "./types";

export async function createDraftPR(
  orgId: string,
  requestedBy: string,
  vesselId?: string,
  notes?: string,
  workOrderId?: string
) {
  const requestNumber = await repo.generateRequestNumber(orgId);

  const pr = await repo.createPurchaseRequest({
    orgId,
    requestNumber,
    requestedBy,
    vesselId,
    workOrderId,
    notes,
    status: "draft",
  });

  await repo.createPREvent(orgId, pr.id, "created", requestedBy, {
    requestNumber,
    workOrderId,
  });

  return pr;
}

export async function getPR(id: string, orgId: string) {
  return repo.getPurchaseRequestWithItems(id, orgId);
}

export async function listPRs(filters: PRListFilters) {
  return repo.listPurchaseRequests(filters);
}

export async function updatePRDraft(
  id: string,
  orgId: string,
  data: Partial<InsertPurchaseRequest>,
  userId?: string
) {
  const pr = await repo.getPurchaseRequestById(id, orgId);
  if (!pr) {throw new Error("Purchase request not found");}
  if (pr.status !== "draft") {throw new Error("Can only edit draft PRs");}

  const updated = await repo.updatePurchaseRequest(id, orgId, {
    ...data,
    lastDraftSaveAt: new Date(),
  });

  await repo.createPREvent(orgId, id, "draft_saved", userId);
  return updated;
}

export async function addItemToPR(
  prId: string,
  orgId: string,
  data: Omit<InsertPurchaseRequestItem, "orgId" | "prId">,
  userId?: string
) {
  const pr = await repo.getPurchaseRequestById(prId, orgId);
  if (!pr) {throw new Error("Purchase request not found");}
  if (pr.status !== "draft") {throw new Error("Can only add items to draft PRs");}

  const [part] = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, data.partId), eq(parts.orgId, orgId)));
  if (!part) {throw new Error("Part not found or does not belong to organization");}
  const currentRob = part?.quantity ?? 0;

  if (data.supplierId) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.orgId, orgId)));
    if (!supplier) {throw new Error("Supplier not found or does not belong to organization");}
  }

  const item = await repo.addPurchaseRequestItem({
    ...data,
    orgId,
    prId,
    robSnapshot: currentRob,
  });

  await repo.createPREvent(orgId, prId, "item_added", userId, {
    partId: data.partId,
    quantity: data.quantity,
  });

  return item;
}

export async function removeItemFromPR(
  prId: string,
  itemId: string,
  orgId: string,
  userId?: string
) {
  const pr = await repo.getPurchaseRequestById(prId, orgId);
  if (!pr) {throw new Error("Purchase request not found");}
  if (pr.status !== "draft")
    {throw new Error("Can only remove items from draft PRs");}

  const removed = await repo.removePurchaseRequestItem(itemId, prId, orgId);

  if (removed) {
    await repo.createPREvent(orgId, prId, "item_removed", userId, {
      itemId,
    });
  }

  return removed;
}
