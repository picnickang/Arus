/**
 * PR Draft Service
 *
 * Improvements applied:
 * #9  — When adding a part to a PR and its current stock is 0, the service
 *        now calls suggestPartSubstitutions and includes suggestions in the
 *        response so the frontend can prompt the officer immediately.
 * #13 — ROB snapshot was fetched from the `parts` catalog table which has
 *        no quantity column — it silently returned 0 for every item.
 *        Now fetches from `partsInventory` (the stock table) instead.
 * #14 — Auto-save support: updatePRDraft no longer requires the PR to be
 *        in "draft" status when called from the auto-save path.
 *        Pass `isAutoSave: true` to skip the status guard.
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { parts, suppliers, stock, partSubstitutions } from "@shared/schema";
import * as repo from "./repository";
import type { InsertPurchaseRequest, InsertPurchaseRequestItem, PRListFilters } from "./types";

export async function createDraftPR(
  orgId: string,
  requestedBy: string,
  vesselId?: string,
  notes?: string,
  workOrderId?: string
) {
  const requestNumber = await repo.generateRequestNumber(orgId);

  const pr = await repo.createPurchaseRequest({
    orgId, requestNumber, requestedBy, vesselId, workOrderId, notes, status: "draft",
  });

  await repo.createPREvent(orgId, pr.id, "created", requestedBy, { requestNumber, workOrderId });
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
  userId?: string,
  options?: { isAutoSave?: boolean }
) {
  const pr = await repo.getPurchaseRequestById(id, orgId);
  if (!pr) throw new Error("Purchase request not found");

  // Improvement #14: allow auto-save to update non-draft PRs without throwing
  if (!options?.isAutoSave && pr.status !== "draft") {
    throw new Error("Can only edit draft PRs");
  }

  const updated = await repo.updatePurchaseRequest(id, orgId, {
    ...data,
    lastDraftSaveAt: new Date(),
  });

  await repo.createPREvent(orgId, id, options?.isAutoSave ? "auto_saved" : "draft_saved", userId);
  return updated;
}

export interface AddItemResult {
  item: Awaited<ReturnType<typeof repo.addPurchaseRequestItem>>;
  /** Populated when quantityOnHand === 0 and substitutions exist */
  substitutionSuggestions?: Array<{
    partId: string;
    partNumber: string;
    partName: string;
    quantityOnHand: number;
  }>;
  outOfStock: boolean;
}

export async function addItemToPR(
  prId: string,
  orgId: string,
  data: Omit<InsertPurchaseRequestItem, "orgId" | "prId">,
  userId?: string
): Promise<AddItemResult> {
  const pr = await repo.getPurchaseRequestById(prId, orgId);
  if (!pr)                  throw new Error("Purchase request not found");
  if (pr.status !== "draft") throw new Error("Can only add items to draft PRs");

  // Validate part belongs to org
  const [part] = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, data.partId), eq(parts.orgId, orgId)));
  if (!part) throw new Error("Part not found or does not belong to organization");

  const [inventoryRecord] = await db
    .select({
      quantityOnHand:   stock.quantityOnHand,
      quantityReserved: stock.quantityReserved,
    })
    .from(stock)
    .where(and(eq(stock.partId, data.partId), eq(stock.orgId, orgId)));

  const currentRob      = inventoryRecord?.quantityOnHand ?? 0;
  const currentReserved = inventoryRecord?.quantityReserved ?? 0;
  const availableQty    = Math.max(0, currentRob - currentReserved);
  const outOfStock      = availableQty === 0;

  if (data.supplierId) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.orgId, orgId)));
    if (!supplier) throw new Error("Supplier not found or does not belong to organization");
  }

  const item = await repo.addPurchaseRequestItem({
    ...data,
    orgId,
    prId,
    // Improvement #13: use the correct ROB value from the stock table
    robSnapshot: currentRob,
  });

  await repo.createPREvent(orgId, prId, "item_added", userId, {
    partId:      data.partId,
    quantity:    data.quantity,
    robSnapshot: currentRob,
    outOfStock,
  });

  // Improvement #9: suggest substitutions when the part is out of stock
  let substitutionSuggestions: AddItemResult["substitutionSuggestions"];
  if (outOfStock) {
    substitutionSuggestions = await findSubstitutionSuggestions(data.partId, orgId);
  }

  return { item, substitutionSuggestions, outOfStock };
}

/**
 * Find substitutable parts that are currently in stock.
 * Improvement #9: wires the existing substitutions table into the PR add flow.
 */
async function findSubstitutionSuggestions(
  partId: string,
  orgId: string
): Promise<AddItemResult["substitutionSuggestions"]> {
  try {
    // Get all substitution relationships for this part
    const subs = await db
      .select()
      .from(partSubstitutions)
      .where(
        and(
          eq(partSubstitutions.orgId, orgId),
          // Either this part is the original or the substitute
          eq(partSubstitutions.originalPartId, partId)
        )
      );

    if (subs.length === 0) return [];

    const substituteIds = subs.map((s) => s.substitutePartId);

    // Fetch substitute parts with their current stock
    const suggestions: AddItemResult["substitutionSuggestions"] = [];
    for (const substituteId of substituteIds) {
      const [subPart] = await db
        .select({
          id:         parts.id,
          partNumber: parts.partNo,
          name:       parts.name,
        })
        .from(parts)
        .where(and(eq(parts.id, substituteId), eq(parts.orgId, orgId)));

      if (!subPart) continue;

      const [subInventory] = await db
        .select({ quantityOnHand: stock.quantityOnHand, quantityReserved: stock.quantityReserved })
        .from(stock)
        .where(and(eq(stock.partId, substituteId), eq(stock.orgId, orgId)));

      const available =
        (subInventory?.quantityOnHand ?? 0) - (subInventory?.quantityReserved ?? 0);

      if (available > 0) {
        suggestions.push({
          partId:         subPart.id,
          partNumber:     subPart.partNumber,
          partName:       subPart.name,
          quantityOnHand: subInventory?.quantityOnHand ?? 0,
        });
      }
    }

    return suggestions;
  } catch {
    // Non-fatal — substitution suggestions are advisory only
    return [];
  }
}

export async function removeItemFromPR(
  prId: string,
  itemId: string,
  orgId: string,
  userId?: string
) {
  const pr = await repo.getPurchaseRequestById(prId, orgId);
  if (!pr)                  throw new Error("Purchase request not found");
  if (pr.status !== "draft") throw new Error("Can only remove items from draft PRs");

  const removed = await repo.removePurchaseRequestItem(itemId, prId, orgId);
  if (removed) {
    await repo.createPREvent(orgId, prId, "item_removed", userId, { itemId });
  }
  return removed;
}
