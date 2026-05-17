// @ts-nocheck
/**
 * Purchasing Repository
 *
 * Improvements applied:
 * #3  — PR number now uses a PostgreSQL sequence (nextval) instead of MAX+1.
 *        Zero race conditions under concurrent load.
 * #18 — deletePurchaseRequest no longer fetches PR twice (removed the
 *        redundant getPR call in the DELETE route — caller now passes the
 *        already-fetched PR directly when it has it).
 */

import { db } from "../db";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
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
  if (!pr) {
    return null;
  }

  const rawItems = await db
    .select()
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.prId, id));

  const partIds = [...new Set(rawItems.map((i) => i.partId).filter(Boolean))] as string[];
  const supplierIds = [...new Set(rawItems.map((i) => i.supplierId).filter(Boolean))] as string[];

  const partsMap = new Map<string, { name: string; partNumber: string }>();
  const suppliersMap = new Map<string, string>();

  if (partIds.length > 0) {
    const partRows = await db
      .select({ id: parts.id, name: parts.name, partNumber: parts.partNumber })
      .from(parts)
      .where(inArray(parts.id, partIds));
    for (const p of partRows) {
      partsMap.set(p.id, { name: p.name, partNumber: p.partNumber });
    }
  }
  if (supplierIds.length > 0) {
    const supplierRows = await db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(inArray(suppliers.id, supplierIds));
    for (const s of supplierRows) {
      suppliersMap.set(s.id, s.name);
    }
  }

  const items: PRItemWithDetails[] = rawItems.map((item) => {
    const part = item.partId ? partsMap.get(item.partId) : null;
    return {
      ...item,
      partName: part?.name ?? null,
      partNumber: part?.partNumber ?? null,
      supplierName: item.supplierId ? (suppliersMap.get(item.supplierId) ?? null) : null,
    } as PRItemWithDetails;
  });

  return { ...pr, items };
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
  const [result] = await db.insert(purchaseRequestItems).values(data).returning();
  return result;
}

export async function removePurchaseRequestItem(id: string, prId: string, orgId: string) {
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

export async function unlinkItemSupplier(partId: string, supplierId: string, orgId: string) {
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

/**
 * Improvement #3: Sequence-based PR number generation.
 *
 * Uses nextval() on a per-year PostgreSQL sequence so concurrent requests
 * each get a strictly unique number with no application-level race window.
 *
 * The sequence pr_number_seq_YYYY is created by migration 001.
 * If the sequence doesn't exist yet (e.g. first request of a new year),
 * it is created on-the-fly and the year rolls over cleanly.
 */
export async function generateRequestNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const seqName = `pr_number_seq_${year}`;

  // Ensure the sequence exists for this year (idempotent)
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS ${sql.identifier(seqName)}
    START WITH 1 INCREMENT BY 1
  `);

  const result = await db.execute(sql`SELECT nextval(${seqName}) AS next_num`);
  const nextNum = Number((result.rows[0] as any).next_num);
  return `PR-${year}-${String(nextNum).padStart(4, "0")}`;
}

/**
 * Sequence-based PO number generation (used inside transactions).
 * Called from pr-send-service.ts to generate PO numbers atomically.
 */
export async function generatePONumber(orgId: string, tx?: any): Promise<string> {
  const year = new Date().getFullYear();
  const seqName = `po_number_seq_${year}`;
  const executor = tx ?? db;

  await executor.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS ${sql.identifier(seqName)}
    START WITH 1 INCREMENT BY 1
  `);

  const result = await executor.execute(sql`SELECT nextval(${seqName}) AS next_num`);
  const nextNum = Number((result.rows[0] as any).next_num);
  return `PO-${year}-${String(nextNum).padStart(4, "0")}`;
}
