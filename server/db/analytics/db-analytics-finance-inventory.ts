import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "../../db-config";
import { expenses, laborRates, parts, stock } from "@shared/schema-runtime";
import type {
  Expense,
  InsertExpense,
  InsertLaborRate,
  LaborRate,
  Part,
} from "@shared/schema";

export async function updatePartCost(
  partId: string,
  updateData: { unitCost: number; supplier: string },
  orgId: string
): Promise<Part> {
  if (!orgId || orgId.trim() === "") {
    throw new Error("Organization ID is required");
  }
  await db
    .update(parts)
    .set({ standardCost: updateData.unitCost, updatedAt: new Date() })
    .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  await db
    .update(stock)
    .set({ unitCost: updateData.unitCost, updatedAt: new Date() })
    .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)));
  const [u] = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  if (!u) {
    throw new Error(`Part ${partId} not found`);
  }
  return u;
}

export async function updatePartStockQuantities(
  partId: string,
  updateData: {
    quantityOnHand?: number;
    quantityReserved?: number;
    minStockLevel?: number;
    maxStockLevel?: number;
  },
  orgId: string
): Promise<Part> {
  if (!orgId || orgId.trim() === "") {
    throw new Error("Organization ID is required");
  }
  if (updateData.quantityReserved !== undefined && updateData.quantityReserved < 0) {
    throw new Error("validation: Reserved quantity cannot be negative");
  }
  if (updateData.minStockLevel !== undefined && updateData.minStockLevel < 0) {
    throw new Error("validation: Minimum stock level cannot be negative");
  }
  if (updateData.maxStockLevel !== undefined && updateData.maxStockLevel < 0) {
    throw new Error("validation: Maximum stock level cannot be negative");
  }
  const currentPart = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)))
    .limit(1);
  if (currentPart.length === 0) {
    throw new Error(`Part ${partId} not found`);
  }
  const part = currentPart[0];
  if (!part) {
    throw new Error(`Part ${partId} not found`);
  }
  const [currentStockRow] = await db
    .select()
    .from(stock)
    .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)))
    .limit(1);
  const newMinStock = updateData.minStockLevel ?? part.minStockQty ?? 0;
  const newMaxStock = updateData.maxStockLevel ?? part.maxStockQty ?? 0;
  if (newMinStock > newMaxStock) {
    throw new Error("validation: Minimum stock level cannot be greater than maximum stock level");
  }
  if (updateData.minStockLevel !== undefined || updateData.maxStockLevel !== undefined) {
    await db
      .update(parts)
      .set({ minStockQty: newMinStock, maxStockQty: newMaxStock, updatedAt: new Date() })
      .where(eq(parts.id, partId));
  }
  const stockUpdates: Partial<{
    quantityOnHand: number;
    quantityReserved: number;
    updatedAt: Date;
  }> = { updatedAt: new Date() };
  if (updateData.quantityOnHand !== undefined) {
    stockUpdates.quantityOnHand = updateData.quantityOnHand;
  }
  if (updateData.quantityReserved !== undefined) {
    stockUpdates.quantityReserved = updateData.quantityReserved;
  }
  if (Object.keys(stockUpdates).length > 1) {
    if (currentStockRow) {
      await db
        .update(stock)
        .set(stockUpdates)
        .where(and(eq(stock.id, currentStockRow.id), eq(stock.orgId, orgId)));
    } else {
      await db.insert(stock).values({
        id: randomUUID(),
        orgId,
        partId,
        partNo: part.partNo,
        location: "MAIN",
        quantityOnHand: updateData.quantityOnHand ?? 0,
        quantityReserved: updateData.quantityReserved ?? 0,
        unitCost: part.standardCost ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
  const [u] = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  if (!u) {
    throw new Error(`Part ${partId} not found`);
  }
  return u;
}

export async function getLaborRates(orgId?: string): Promise<LaborRate[]> {
  const c = [];
  if (orgId) {
    c.push(eq(laborRates.orgId, orgId));
  }
  c.push(eq(laborRates.isActive, true));
  return db
    .select()
    .from(laborRates)
    .where(and(...c))
    .orderBy(laborRates.skillLevel);
}

export async function createLaborRate(rate: InsertLaborRate): Promise<LaborRate> {
  const [n] = await db.insert(laborRates).values(rate).returning();
  if (!n) {
    throw new Error("createLaborRate: no row returned");
  }
  return n;
}

export async function getExpenses(
  dateFrom?: Date,
  dateTo?: Date,
  orgId?: string
): Promise<Expense[]> {
  const c = [];
  if (orgId) {
    c.push(eq(expenses.orgId, orgId));
  }
  if (dateFrom) {
    c.push(gte(expenses.expenseDate, dateFrom));
  }
  if (dateTo) {
    c.push(lte(expenses.expenseDate, dateTo));
  }
  let query = db.select().from(expenses).$dynamic();
  if (c.length > 0) {
    query = query.where(and(...c));
  }
  return query.orderBy(desc(expenses.expenseDate));
}

export async function createExpense(expense: InsertExpense): Promise<Expense> {
  const [n] = await db.insert(expenses).values(expense).returning();
  if (!n) {
    throw new Error("createExpense: no row returned");
  }
  return n;
}

export async function updateExpenseStatus(
  expenseId: string,
  status: "pending" | "approved" | "rejected"
): Promise<Expense> {
  const [u] = await db
    .update(expenses)
    .set({
      approvalStatus: status,
      approvedAt: status !== "pending" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId))
    .returning();
  if (!u) {
    throw new Error(`Expense ${expenseId} not found`);
  }
  return u;
}
