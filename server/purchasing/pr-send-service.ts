/**
 * PR Send Service
 *
 * Improvement #3: PO number generation now uses generatePONumber()
 * which calls nextval() on a PostgreSQL sequence inside the transaction.
 * Concurrent PR sends each get a distinct PO number with no race window.
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderEvents,
  purchaseRequestItems,
  parts,
  purchaseRequests,
  purchaseRequestEvents,
  emailQueue,
  itemSuppliers,
  suppliers,
} from "@shared/schema";
import * as repo from "./repository";
import type { PRSendResult } from "./types";
import { generatePOEmailHtmlWithTemplate } from "./email-templates";

export async function sendPR(prId: string, orgId: string, userId?: string): Promise<PRSendResult> {
  return db.transaction(async (tx) => {
    const [pr] = await tx
      .select()
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.orgId, orgId)));

    if (!pr) {
      throw new Error("Purchase request not found");
    }
    if (pr.status !== "draft") {
      throw new Error("Can only send draft PRs");
    }

    const prItems = await tx
      .select({
        id: purchaseRequestItems.id,
        orgId: purchaseRequestItems.orgId,
        prId: purchaseRequestItems.prId,
        partId: purchaseRequestItems.partId,
        supplierId: purchaseRequestItems.supplierId,
        quantity: purchaseRequestItems.quantity,
        robSnapshot: purchaseRequestItems.robSnapshot,
        uom: purchaseRequestItems.uom,
        remarks: purchaseRequestItems.remarks,
        createdAt: purchaseRequestItems.createdAt,
        partName: parts.name,
        partNumber: (parts as object as { partNumber: typeof parts.name }).partNumber,
        supplierName: suppliers.name,
      })
      .from(purchaseRequestItems)
      .leftJoin(parts, eq(purchaseRequestItems.partId, parts.id))
      .leftJoin(suppliers, eq(purchaseRequestItems.supplierId, suppliers.id))
      .where(eq(purchaseRequestItems.prId, prId));

    if (!prItems.length) {
      throw new Error("Cannot send PR with no items");
    }

    type PRItem = (typeof prItems)[0];
    const itemsBySupplier = new Map<string, { supplierId: string; items: PRItem[] }>();

    for (const item of prItems) {
      let supplierId: string | null = item.supplierId;
      if (!supplierId) {
        const linked = await tx
          .select({ supplierId: itemSuppliers.supplierId, isPrimary: itemSuppliers.isPrimary })
          .from(itemSuppliers)
          .where(and(eq(itemSuppliers.partId, item.partId), eq(itemSuppliers.orgId, orgId)));
        const primary = linked.find((s) => s.isPrimary);
        supplierId = primary?.supplierId ?? linked[0]?.supplierId ?? null;
      }
      if (!supplierId) {
        throw new Error(`No supplier assigned for part: ${item.partName || item.partId}`);
      }
      if (!itemsBySupplier.has(supplierId)) {
        itemsBySupplier.set(supplierId, { supplierId, items: [] });
      }
      itemsBySupplier.get(supplierId)!.items.push(item);
    }

    const createdPOs: PRSendResult["purchaseOrders"] = [];
    let emailsQueued = 0;

    for (const [supplierId, group] of itemsBySupplier) {
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, supplierId), eq(suppliers.orgId, orgId)));
      if (!supplier) {
        throw new Error(`Supplier not found: ${supplierId}`);
      }

      // Improvement #3: sequence-based PO number — no race condition
      const poNumber = await repo.generatePONumber(orgId, tx);

      const itemsWithCosts: { item: (typeof group.items)[0]; unitCost: number }[] = [];
      for (const item of group.items) {
        const linked = await tx
          .select({ supplierId: itemSuppliers.supplierId, unitCost: itemSuppliers.unitCost })
          .from(itemSuppliers)
          .where(and(eq(itemSuppliers.partId, item.partId), eq(itemSuppliers.orgId, orgId)));
        const supplierLink = linked.find((s) => s.supplierId === supplierId);
        itemsWithCosts.push({ item, unitCost: supplierLink?.unitCost ?? 0 });
      }

      const totalAmount = itemsWithCosts.reduce(
        (sum, { item, unitCost }) => sum + (item.quantity || 0) * unitCost,
        0
      );

      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          orgId,
          supplierId,
          orderNumber: poNumber,
          status: "sent",
          totalAmount,
          currency: "USD",
          createdBy: userId || pr.requestedBy,
          expectedDate: pr.requiredByDate,
          notes: `Generated from PR ${pr.requestNumber}`,
        })
        .returning();
      if (!po) {throw new Error("sendPR: purchaseOrders insert returned no row");}

      for (const { item, unitCost } of itemsWithCosts) {
        await tx.insert(purchaseOrderItems).values({
          orgId,
          poId: po.id,
          partId: item.partId,
          quantity: item.quantity,
          unitPrice: unitCost,
          totalPrice: (item.quantity || 0) * unitCost,
          receivedQuantity: 0,
          rejectedQuantity: 0,
        });
      }

      await tx.insert(purchaseOrderEvents).values({
        orgId,
        poId: po.id,
        eventType: "created",
        userId,
        details: { prId, supplierId, itemCount: group.items.length },
      });

      if (supplier.email) {
        const emailContent = await generatePOEmailHtmlWithTemplate(
          orgId,
          po,
          group.items as object as Parameters<typeof generatePOEmailHtmlWithTemplate>[2],
          supplier,
          pr
        );
        await tx.insert(emailQueue).values({
          orgId,
          prId,
          supplierId,
          recipientEmail: supplier.email,
          recipientName: supplier.contactName || supplier.name,
          subject: emailContent.subject,
          htmlContent: emailContent.body,
          status: "pending",
        });
        emailsQueued++;
      }

      createdPOs.push({ poId: po.id, supplierId, supplierName: supplier.name });
    }

    await tx
      .update(purchaseRequests)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.orgId, orgId)));

    await tx.insert(purchaseRequestEvents).values({
      orgId,
      prId,
      eventType: "sent",
      userId,
      details: { purchaseOrders: createdPOs, emailsQueued },
    });

    return { prId, purchaseOrders: createdPOs, emailsQueued };
  });
}

export async function cancelPR(prId: string, orgId: string, userId?: string) {
  const pr = await repo.getPurchaseRequestById(prId, orgId);
  if (!pr) {
    throw new Error("Purchase request not found");
  }
  if (pr.status === "closed" || pr.status === "cancelled") {
    throw new Error("Cannot cancel a closed or already cancelled PR");
  }
  const updated = await repo.updatePurchaseRequest(prId, orgId, { status: "cancelled" });
  await repo.createPREvent(orgId, prId, "cancelled", userId);
  return updated;
}

export async function closePR(prId: string, orgId: string, userId?: string) {
  const pr = await repo.getPurchaseRequestById(prId, orgId);
  if (!pr) {
    throw new Error("Purchase request not found");
  }
  if (pr.status !== "sent") {
    throw new Error("Can only close sent PRs");
  }
  const updated = await repo.updatePurchaseRequest(prId, orgId, {
    status: "closed",
    closedAt: new Date(),
  });
  await repo.createPREvent(orgId, prId, "closed", userId);
  return updated;
}
