import type { WidenPartial } from "../lib/widen-partial";
/**
 * Supplier Repository
 * Database operations for supplier management
 */

import { db } from "../db";
import { eq, and, or, ilike, sql, count } from "drizzle-orm";
import { suppliers, purchaseOrders } from "@shared/schema";
import type { InsertSupplier, SupplierListFilters, SupplierWithStats } from "./types";

export async function createSupplier(data: InsertSupplier) {
  const [result] = await db
    .insert(suppliers)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return result;
}

export async function getSupplierById(id: string, orgId: string) {
  const [result] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)));
  return result;
}

export async function getSupplierByCode(code: string, orgId: string) {
  const [result] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.code, code), eq(suppliers.orgId, orgId)));
  return result;
}

export async function listSuppliers(filters: SupplierListFilters) {
  const conditions = [eq(suppliers.orgId, filters.orgId)];

  if (filters.isActive !== undefined) {
    conditions.push(eq(suppliers.isActive, filters.isActive));
  }

  if (filters.isPreferred !== undefined) {
    conditions.push(eq(suppliers.isPreferred, filters.isPreferred));
  }

  if (filters.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type];
    if (types.length === 1) {
      conditions.push(eq(suppliers.type, types[0]!));
    } else {
      conditions.push(or(...types.map((t) => eq(suppliers.type, t)))!);
    }
  }

  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(suppliers.name, searchTerm),
        ilike(suppliers.code, searchTerm),
        ilike(suppliers.contactName, searchTerm)
      )!
    );
  }

  return db
    .select()
    .from(suppliers)
    .where(and(...conditions))
    .orderBy(sql`${suppliers.createdAt} DESC`)
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);
}

export async function updateSupplier(
  id: string,
  orgId: string,
  data: WidenPartial<InsertSupplier>
) {
  const [result] = await db
    .update(suppliers)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)))
    .returning();
  return result;
}

export async function deleteSupplier(id: string, orgId: string) {
  const [result] = await db
    .delete(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)))
    .returning();
  return result;
}

export async function getSuppliersWithOrderStats(orgId: string): Promise<SupplierWithStats[]> {
  const allSuppliers = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.orgId, orgId))
    .orderBy(sql`${suppliers.createdAt} DESC`);

  const orderCounts = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      orderCount: count(purchaseOrders.id),
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.orgId, orgId))
    .groupBy(purchaseOrders.supplierId);

  const orderCountMap = new Map<string, number>();
  for (const { supplierId, orderCount } of orderCounts) {
    if (supplierId) {
      orderCountMap.set(supplierId, orderCount);
    }
  }

  return allSuppliers.map((supplier) => ({
    ...supplier,
    orderCount: orderCountMap.get(supplier.id) ?? 0,
  })) as SupplierWithStats[];
}

export async function countSuppliers(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(suppliers)
    .where(eq(suppliers.orgId, orgId));
  return result?.count ?? 0;
}

export async function getPreferredSuppliers(orgId: string) {
  return db
    .select()
    .from(suppliers)
    .where(
      and(eq(suppliers.orgId, orgId), eq(suppliers.isPreferred, true), eq(suppliers.isActive, true))
    )
    .orderBy(suppliers.name);
}
