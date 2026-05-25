/**
 * Inventory - Database Storage Parts & Inventory
 *
 * Consolidated: all queries now use `parts` + `stock` as the canonical model.
 * The deprecated `partsInventory` table is no longer queried directly.
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { parts, stock } from "@shared/schema-runtime";
import type { Part, Stock, InsertPart, PartsInventory, InsertPartsInventory } from "@shared/schema";
import type { PartFilters, AvailabilityResult } from "./types.js";
import { stripUndefined } from "../../lib/strip-undefined";

export function partAndStockToPartsInventory(
  part: Part,
  stockRowOrRows: Stock | Stock[] | null
): PartsInventory {
  const rows = stockRowOrRows
    ? Array.isArray(stockRowOrRows)
      ? stockRowOrRows
      : [stockRowOrRows]
    : [];

  const totalOnHand = rows.reduce((sum, r) => sum + Math.round(r.quantityOnHand ?? 0), 0);
  const totalReserved = rows.reduce((sum, r) => sum + Math.round(r.quantityReserved ?? 0), 0);
  const avgUnitCost =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.unitCost ?? 0), 0) / rows.length
      : (part.standardCost ?? 0);

  return {
    id: part.id,
    orgId: part.orgId,
    partNumber: part.partNo,
    partName: part.name,
    description: part.description,
    category: part.category || "general",
    manufacturer: part.manufacturer ?? null,
    unitCost: avgUnitCost,
    quantityOnHand: totalOnHand,
    quantityReserved: totalReserved,
    minStockLevel: Math.round(part.minStockQty ?? 0),
    maxStockLevel: Math.round(part.maxStockQty ?? 0),
    location: rows[0]?.location ?? "MAIN",
    supplierName: null,
    supplierPartNumber: null,
    leadTimeDays: part.leadTimeDays ?? 7,
    isActive: part.isActive ?? true,
    createdAt: part.createdAt,
    updatedAt: part.updatedAt,
  } as PartsInventory;
}

export class DbPartsStorage {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) {
      throw new Error(`[${method}] orgId is required`);
    }
  }

  async getParts(orgId?: string, filters?: PartFilters): Promise<Part[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(parts.orgId, orgId));
    }
    if (filters?.category) {
      conditions.push(eq(parts.category, filters.category));
    }
    if (conditions.length > 0) {
      return db
        .select()
        .from(parts)
        .where(and(...conditions))
        .orderBy(parts.name);
    }
    return db.select().from(parts).orderBy(parts.name);
  }

  async getPart(id: string, orgId?: string): Promise<Part | undefined> {
    const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id);
    const [result] = await db.select().from(parts).where(conditions);
    return result;
  }
  async getPartByPartNumber(partNumber: string, orgId: string): Promise<Part | undefined> {
    this.validateOrgId(orgId, "getPartByPartNumber");
    const [result] = await db
      .select()
      .from(parts)
      .where(and(eq(parts.partNo, partNumber), eq(parts.orgId, orgId)));
    return result;
  }
  async createPart(partData: InsertPart): Promise<Part> {
    const [newPart] = await db
      .insert(parts)
      .values({ id: randomUUID(), ...partData, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!newPart) throw new Error("Failed to create part");
    return newPart;
  }
  async updatePart(id: string, updates: Partial<InsertPart>, orgId?: string): Promise<Part> {
    this.validateOrgId(orgId, "updatePart");
    const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id);
    // Drizzle's `.set({ col: undefined })` semantics are version-dependent;
    // strip undefined keys to preserve falsy values (0, false, '') while
    // never writing NULL for omitted partial-update fields.
    const [updated] = await db
      .update(parts)
      .set({ ...stripUndefined(updates), updatedAt: new Date() })
      .where(conditions)
      .returning();
    if (!updated) {
      throw new Error(`Part ${id} not found`);
    }
    return updated;
  }
  async deletePart(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deletePart");
    const partConditions = orgId
      ? and(eq(parts.id, id), eq(parts.orgId, orgId))
      : eq(parts.id, id);
    const stockConditions = orgId
      ? and(eq(stock.partId, id), eq(stock.orgId, orgId))
      : eq(stock.partId, id);
    // Cascade dependent stock rows first to avoid FK violation. Wrap in a
    // transaction so a failure leaves both tables consistent.
    await db.transaction(async (tx) => {
      await tx.delete(stock).where(stockConditions);
      await tx.delete(parts).where(partConditions);
    });
  }

  async getPartsInventory(orgId?: string): Promise<PartsInventory[]> {
    const partsRows = orgId
      ? await db.select().from(parts).where(eq(parts.orgId, orgId))
      : await db.select().from(parts);

    if (partsRows.length === 0) {
      return [];
    }

    const partIds = partsRows.map((p) => p.id);
    const partIdsArray = sql`ARRAY[${sql.join(
      partIds.map((id) => sql`${id}`),
      sql`, `
    )}]::text[]`;
    const stockRows = await db
      .select()
      .from(stock)
      .where(
        orgId
          ? and(eq(stock.orgId, orgId), sql`${stock.partId} = ANY(${partIdsArray})`)
          : sql`${stock.partId} = ANY(${partIdsArray})`
      );
    const stockByPartId = new Map<string, Stock[]>();
    for (const s of stockRows) {
      const arr = stockByPartId.get(s.partId) || [];
      arr.push(s);
      stockByPartId.set(s.partId, arr);
    }

    return partsRows.map((p) => partAndStockToPartsInventory(p, stockByPartId.get(p.id) || []));
  }

  async getPartsInventoryByPart(
    partId: string,
    orgId?: string
  ): Promise<PartsInventory | undefined> {
    const conditions = orgId
      ? and(eq(parts.id, partId), eq(parts.orgId, orgId))
      : eq(parts.id, partId);
    const [part] = await db.select().from(parts).where(conditions);
    if (!part) {
      return undefined;
    }

    const stockRows = await db
      .select()
      .from(stock)
      .where(
        orgId ? and(eq(stock.partId, partId), eq(stock.orgId, orgId)) : eq(stock.partId, partId)
      );

    return partAndStockToPartsInventory(part, stockRows);
  }

  async createPartsInventory(inventory: InsertPartsInventory): Promise<PartsInventory> {
    const partData: InsertPart = {
      orgId: inventory.orgId,
      partNo: inventory.partNumber,
      name: inventory.partName,
      description: inventory.description,
      category: inventory.category,
      standardCost: inventory.unitCost,
      minStockQty: inventory.minStockLevel ?? 0,
      maxStockQty: inventory.maxStockLevel ?? 0,
      leadTimeDays: inventory.leadTimeDays ?? 7,
      manufacturer: inventory.manufacturer ?? null,
      isActive: inventory.isActive ?? true,
    };

    const partId = randomUUID();
    const [newPart] = await db
      .insert(parts)
      .values({
        id: partId,
        ...partData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!newPart) throw new Error("Failed to create part for inventory");
    const [newStock] = await db
      .insert(stock)
      .values({
        orgId: inventory.orgId,
        partId: newPart.id,
        partNo: newPart.partNo,
        location: inventory.location || "MAIN",
        quantityOnHand: inventory.quantityOnHand ?? 0,
        quantityReserved: inventory.quantityReserved ?? 0,
        unitCost: inventory.unitCost ?? 0,
      })
      .returning();

    if (!newStock) throw new Error("Failed to create stock");
    return partAndStockToPartsInventory(newPart, newStock);
  }

  async updatePartsInventory(
    id: string,
    updates: import("../../lib/widen-partial").WidenPartial<InsertPartsInventory>
  ): Promise<PartsInventory> {
    const partUpdates: Partial<InsertPart> = {};
    if (updates.partNumber !== undefined) {
      partUpdates.partNo = updates.partNumber;
    }
    if (updates.partName !== undefined) {
      partUpdates.name = updates.partName;
    }
    if (updates.description !== undefined) {
      partUpdates.description = updates.description;
    }
    if (updates.category !== undefined) {
      partUpdates.category = updates.category;
    }
    if (updates.manufacturer !== undefined) {
      partUpdates.manufacturer = updates.manufacturer;
    }
    if (updates.unitCost !== undefined) {
      partUpdates.standardCost = updates.unitCost;
    }
    if (updates.minStockLevel !== undefined) {
      partUpdates.minStockQty = updates.minStockLevel;
    }
    if (updates.maxStockLevel !== undefined) {
      partUpdates.maxStockQty = updates.maxStockLevel;
    }
    if (updates.leadTimeDays !== undefined) {
      partUpdates.leadTimeDays = updates.leadTimeDays;
    }
    if (updates.isActive !== undefined) {
      partUpdates.isActive = updates.isActive ?? undefined;
    }

    if (Object.keys(partUpdates).length > 0) {
      await db
        .update(parts)
        .set({ ...partUpdates, updatedAt: new Date() })
        .where(eq(parts.id, id));
    }

    if (
      updates.quantityOnHand !== undefined ||
      updates.quantityReserved !== undefined ||
      updates.location !== undefined ||
      updates.unitCost !== undefined
    ) {
      const stockUpdates: Partial<{
        quantityOnHand: number;
        quantityReserved: number;
        unitCost: number;
        updatedAt: Date;
      }> = { updatedAt: new Date() };
      if (updates.quantityOnHand !== undefined) {
        stockUpdates.quantityOnHand = updates.quantityOnHand;
      }
      if (updates.quantityReserved !== undefined) {
        stockUpdates.quantityReserved = updates.quantityReserved;
      }
      if (updates.unitCost !== undefined) {
        stockUpdates.unitCost = updates.unitCost;
      }

      const existingStock = await db.select().from(stock).where(eq(stock.partId, id)).limit(1);
      if (existingStock.length > 0) {
        await db.update(stock).set(stockUpdates).where(eq(stock.partId, id));
      } else {
        const [part] = await db.select().from(parts).where(eq(parts.id, id));
        if (part) {
          await db.insert(stock).values({
            orgId: part.orgId,
            partId: id,
            partNo: part.partNo,
            location: updates.location || "MAIN",
            quantityOnHand: updates.quantityOnHand ?? 0,
            quantityReserved: updates.quantityReserved ?? 0,
            unitCost: updates.unitCost ?? part.standardCost ?? 0,
          });
        }
      }
    }

    const inv = await this.getPartsInventoryByPart(id);
    if (!inv) {
      throw new Error(`Parts inventory ${id} not found`);
    }
    return inv;
  }

  async deletePartsInventory(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deletePartsInventory");
    await db.delete(stock).where(eq(stock.partId, id));
    const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id);
    await db.delete(parts).where(conditions);
  }

  async reserveParts(
    partId: string,
    quantity: number,
    workOrderId: string,
    orgId: string
  ): Promise<void> {
    this.validateOrgId(orgId, "reserveParts");
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) {
      throw new Error(`Inventory for part ${partId} not found`);
    }
    const available = inventory.quantityOnHand - (inventory.quantityReserved || 0);
    if (available < quantity) {
      throw new Error(
        `Insufficient stock for part ${partId}. Available: ${available}, Requested: ${quantity}`
      );
    }

    const stockRows = await db
      .select()
      .from(stock)
      .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)))
      .orderBy(sql`(${stock.quantityOnHand} - ${stock.quantityReserved}) DESC`);
    let remaining = quantity;
    for (const row of stockRows) {
      if (remaining <= 0) {
        break;
      }
      const rowAvailable = Math.max(0, (row.quantityOnHand ?? 0) - (row.quantityReserved ?? 0));
      const toReserve = Math.min(remaining, rowAvailable);
      if (toReserve > 0) {
        await db
          .update(stock)
          .set({
            quantityReserved: (row.quantityReserved ?? 0) + toReserve,
            updatedAt: new Date(),
          })
          .where(eq(stock.id, row.id));
        remaining -= toReserve;
      }
    }
  }

  async releaseParts(partId: string, quantity: number, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "releaseParts");
    const stockRows = await db
      .select()
      .from(stock)
      .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)))
      .orderBy(sql`${stock.quantityReserved} DESC`);
    let remaining = quantity;
    for (const row of stockRows) {
      if (remaining <= 0) {
        break;
      }
      const reserved = row.quantityReserved ?? 0;
      if (reserved <= 0) {
        continue;
      }
      const toRelease = Math.min(remaining, reserved);
      await db
        .update(stock)
        .set({
          quantityReserved: reserved - toRelease,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, row.id));
      remaining -= toRelease;
    }
  }

  async checkPartAvailability(
    partId: string,
    quantity: number,
    orgId: string
  ): Promise<AvailabilityResult> {
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) {
      return { available: false, quantityOnHand: 0, quantityReserved: 0 };
    }
    return {
      available: inventory.quantityOnHand - (inventory.quantityReserved || 0) >= quantity,
      quantityOnHand: inventory.quantityOnHand,
      quantityReserved: inventory.quantityReserved || 0,
    };
  }
}
