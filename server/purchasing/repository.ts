/**
 * Purchasing Repository
 * Database operations for PR → PO workflow
 */

import { db } from "../db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  purchaseRequests,
  purchaseRequestItems,
  itemSuppliers,
  purchaseRequestEvents,
  purchaseOrderEvents,
  emailQueue,
  parts,
  suppliers,
} from "@shared/schema";
import type {
  PRListFilters,
  InsertPurchaseRequest,
  InsertPurchaseRequestItem,
  InsertItemSupplier,
  InsertEmailQueueItem,
  PRItemWithDetails,
  PRWithItems,
} from "./types";

export async function createPurchaseRequest(data: InsertPurchaseRequest) {
  const [result] = await db.insert(purchaseRequests).values(data).returning();
  return result;
}

export async function getPurchaseRequestById(id: string, orgId: string) {
  const [result] = await db
    .select()
    .from(purchaseRequests)
    .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.orgId, orgId)));
  return result;
}

export async function getPurchaseRequestWithItems(
  id: string,
  orgId: string
): Promise<PRWithItems | null> {
  const pr = await getPurchaseRequestById(id, orgId);
  if (!pr) {return null;}

  const items = await db
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
      partNumber: parts.partNumber,
      supplierName: suppliers.name,
    })
    .from(purchaseRequestItems)
    .leftJoin(parts, eq(purchaseRequestItems.partId, parts.id))
    .leftJoin(suppliers, eq(purchaseRequestItems.supplierId, suppliers.id))
    .where(eq(purchaseRequestItems.prId, id));

  return { ...pr, items: items as PRItemWithDetails[] };
}

export async function listPurchaseRequests(filters: PRListFilters) {
  const conditions = [eq(purchaseRequests.orgId, filters.orgId)];

  if (filters.status) {
    conditions.push(eq(purchaseRequests.status, filters.status));
  }

  if (filters.vesselId) {
    conditions.push(eq(purchaseRequests.vesselId, filters.vesselId));
  }

  if (filters.requestedBy) {
    conditions.push(eq(purchaseRequests.requestedBy, filters.requestedBy));
  }

  if (filters.workOrderId) {
    conditions.push(eq(purchaseRequests.workOrderId, filters.workOrderId));
  }

  if (filters.fromDate) {
    conditions.push(gte(purchaseRequests.createdAt, filters.fromDate));
  }

  if (filters.toDate) {
    conditions.push(lte(purchaseRequests.createdAt, filters.toDate));
  }

  return db
    .select()
    .from(purchaseRequests)
    .where(and(...conditions))
    .orderBy(sql`${purchaseRequests.createdAt} DESC`)
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);
}

export async function updatePurchaseRequest(
  id: string,
  orgId: string,
  data: Partial<InsertPurchaseRequest>
) {
  const [result] = await db
    .update(purchaseRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.orgId, orgId)))
    .returning();
  return result;
}

export async function addPurchaseRequestItem(data: InsertPurchaseRequestItem) {
  const [result] = await db
    .insert(purchaseRequestItems)
    .values(data)
    .returning();
  return result;
}

export async function removePurchaseRequestItem(
  id: string,
  prId: string,
  orgId: string
) {
  const [result] = await db
    .delete(purchaseRequestItems)
    .where(
      and(
        eq(purchaseRequestItems.id, id),
        eq(purchaseRequestItems.prId, prId),
        eq(purchaseRequestItems.orgId, orgId)
      )
    )
    .returning();
  return result;
}

export async function getItemSuppliers(partId: string, orgId: string) {
  return db
    .select({
      id: itemSuppliers.id,
      orgId: itemSuppliers.orgId,
      partId: itemSuppliers.partId,
      supplierId: itemSuppliers.supplierId,
      isPrimary: itemSuppliers.isPrimary,
      supplierPartNumber: itemSuppliers.supplierPartNumber,
      unitCost: itemSuppliers.unitCost,
      leadTimeDays: itemSuppliers.leadTimeDays,
      notes: itemSuppliers.notes,
      createdAt: itemSuppliers.createdAt,
      updatedAt: itemSuppliers.updatedAt,
      supplierName: suppliers.name,
    })
    .from(itemSuppliers)
    .leftJoin(suppliers, eq(itemSuppliers.supplierId, suppliers.id))
    .where(and(eq(itemSuppliers.partId, partId), eq(itemSuppliers.orgId, orgId)));
}

export async function linkItemSupplier(data: InsertItemSupplier) {
  const [result] = await db
    .insert(itemSuppliers)
    .values(data)
    .onConflictDoUpdate({
      target: [itemSuppliers.orgId, itemSuppliers.partId, itemSuppliers.supplierId],
      set: {
        isPrimary: data.isPrimary,
        supplierPartNumber: data.supplierPartNumber,
        unitCost: data.unitCost,
        leadTimeDays: data.leadTimeDays,
        notes: data.notes,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result;
}

export async function unlinkItemSupplier(
  partId: string,
  supplierId: string,
  orgId: string
) {
  const [result] = await db
    .delete(itemSuppliers)
    .where(
      and(
        eq(itemSuppliers.partId, partId),
        eq(itemSuppliers.supplierId, supplierId),
        eq(itemSuppliers.orgId, orgId)
      )
    )
    .returning();
  return result;
}

export async function createPREvent(
  orgId: string,
  prId: string,
  eventType: string,
  userId?: string,
  details?: Record<string, unknown>
) {
  const [result] = await db
    .insert(purchaseRequestEvents)
    .values({ orgId, prId, eventType, userId, details })
    .returning();
  return result;
}

export async function createPOEvent(
  orgId: string,
  poId: string,
  eventType: string,
  userId?: string,
  details?: Record<string, unknown>
) {
  const [result] = await db
    .insert(purchaseOrderEvents)
    .values({ orgId, poId, eventType, userId, details })
    .returning();
  return result;
}

export async function queueEmail(data: InsertEmailQueueItem) {
  const [result] = await db.insert(emailQueue).values(data).returning();
  return result;
}

export async function getPendingEmails(limit = 10) {
  return db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.status, "pending"))
    .orderBy(emailQueue.createdAt)
    .limit(limit);
}

export async function updateEmailStatus(
  id: string,
  status: "sent" | "failed",
  errorMessage?: string
) {
  const updateData: Record<string, unknown> = {
    status,
    attempts: sql`${emailQueue.attempts} + 1`,
    lastAttemptAt: new Date(),
  };
  if (status === "sent") {
    updateData.sentAt = new Date();
  }

  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  const [result] = await db
    .update(emailQueue)
    .set(updateData)
    .where(eq(emailQueue.id, id))
    .returning();
  return result;
}

export async function generateRequestNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const result = await db
    .select({
      maxSeq: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${purchaseRequests.requestNumber} FROM 'PR-\\d{4}-(\\d+)') AS INTEGER)), 0)`,
    })
    .from(purchaseRequests)
    .where(
      and(
        eq(purchaseRequests.orgId, orgId),
        sql`${purchaseRequests.requestNumber} LIKE ${`${prefix  }%`}`
      )
    );

  const nextNum = (result[0]?.maxSeq ?? 0) + 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}
