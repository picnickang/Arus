/**
 * Inventory - Database Storage Parts & Inventory
 *
 * Consolidated: all queries now use `parts` + `stock` as the canonical model.
 * The deprecated `partsInventory` table is no longer queried directly.
 */

import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { parts, stock, type Part, type Stock, type InsertPart, type PartsInventory, type InsertPartsInventory } from "@shared/schema-runtime";
import type { PartFilters, AvailabilityResult } from "./types.js";

export function partAndStockToPartsInventory(part: Part, stockRow: Stock | null): PartsInventory {
  return {
    id: part.id,
    orgId: part.orgId,
    partNumber: part.partNo,
    partName: part.name,
    description: part.description,
    category: part.category || "general",
    manufacturer: part.manufacturer ?? null,
    unitCost: stockRow?.unitCost ?? part.standardCost ?? 0,
    quantityOnHand: Math.round(stockRow?.quantityOnHand ?? 0),
    quantityReserved: Math.round(stockRow?.quantityReserved ?? 0),
    minStockLevel: Math.round(part.minStockQty ?? 0),
    maxStockLevel: Math.round(part.maxStockQty ?? 0),
    location: stockRow?.location ?? "MAIN",
    supplierName: null,
    supplierPartNumber: null,
    leadTimeDays: part.leadTimeDays ?? 7,
    isActive: part.isActive ?? true,
    createdAt: part.createdAt,
    updatedAt: part.updatedAt,
  } as PartsInventory;
}

export class DbPartsStorage {
  private validateOrgId(orgId: string | undefined, method: string): void { if (!orgId) { throw new Error(`[${method}] orgId is required`); } }

  async getParts(orgId?: string, filters?: PartFilters): Promise<Part[]> {
    const conditions = [];
    if (orgId) { conditions.push(eq(parts.orgId, orgId)); }
    if (filters?.category) { conditions.push(eq(parts.category, filters.category)); }
    if (conditions.length > 0) { return db.select().from(parts).where(and(...conditions)).orderBy(parts.name); }
    return db.select().from(parts).orderBy(parts.name);
  }

  async getPart(id: string, orgId?: string): Promise<Part | undefined> { const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id); const [result] = await db.select().from(parts).where(conditions); return result; }
  async getPartByPartNumber(partNumber: string, orgId: string): Promise<Part | undefined> { this.validateOrgId(orgId, "getPartByPartNumber"); const [result] = await db.select().from(parts).where(and(eq(parts.partNo, partNumber), eq(parts.orgId, orgId))); return result; }
  async createPart(partData: InsertPart): Promise<Part> { const [newPart] = await db.insert(parts).values({ id: randomUUID(), ...partData, createdAt: new Date(), updatedAt: new Date() }).returning(); return newPart; }
  async updatePart(id: string, updates: Partial<InsertPart>, orgId?: string): Promise<Part> { this.validateOrgId(orgId, "updatePart"); const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id); const [updated] = await db.update(parts).set({ ...updates, updatedAt: new Date() }).where(conditions).returning(); if (!updated) {throw new Error(`Part ${id} not found`);} return updated; }
  async deletePart(id: string, orgId?: string): Promise<void> { this.validateOrgId(orgId, "deletePart"); const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id); await db.delete(parts).where(conditions); }

  async getPartsInventory(orgId?: string): Promise<PartsInventory[]> {
    const partsRows = orgId
      ? await db.select().from(parts).where(eq(parts.orgId, orgId))
      : await db.select().from(parts);

    if (partsRows.length === 0) return [];

    const partIds = partsRows.map(p => p.id);
    const stockRows = await db.select().from(stock).where(
      orgId
        ? and(eq(stock.orgId, orgId), sql`${stock.partId} = ANY(${partIds})`)
        : sql`${stock.partId} = ANY(${partIds})`
    );
    const stockByPartId = new Map(stockRows.map(s => [s.partId, s]));

    return partsRows.map(p => partAndStockToPartsInventory(p, stockByPartId.get(p.id)));
  }

  async getPartsInventoryByPart(partId: string, orgId?: string): Promise<PartsInventory | undefined> {
    const conditions = orgId ? and(eq(parts.id, partId), eq(parts.orgId, orgId)) : eq(parts.id, partId);
    const [part] = await db.select().from(parts).where(conditions);
    if (!part) return undefined;

    const [stockRow] = await db.select().from(stock).where(
      orgId
        ? and(eq(stock.partId, partId), eq(stock.orgId, orgId))
        : eq(stock.partId, partId)
    ).limit(1);

    return partAndStockToPartsInventory(part, stockRow);
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
    const [newPart] = await db.insert(parts).values({
      id: partId, ...partData, createdAt: new Date(), updatedAt: new Date(),
    }).returning();

    const [newStock] = await db.insert(stock).values({
      orgId: inventory.orgId,
      partId: newPart.id,
      partNo: newPart.partNo,
      location: inventory.location || "MAIN",
      quantityOnHand: inventory.quantityOnHand ?? 0,
      quantityReserved: inventory.quantityReserved ?? 0,
      unitCost: inventory.unitCost ?? 0,
    }).returning();

    return partAndStockToPartsInventory(newPart, newStock);
  }

  async updatePartsInventory(id: string, updates: Partial<InsertPartsInventory>): Promise<PartsInventory> {
    const partUpdates: Partial<InsertPart> = {};
    if (updates.partNumber !== undefined) partUpdates.partNo = updates.partNumber;
    if (updates.partName !== undefined) partUpdates.name = updates.partName;
    if (updates.description !== undefined) partUpdates.description = updates.description;
    if (updates.category !== undefined) partUpdates.category = updates.category;
    if (updates.manufacturer !== undefined) partUpdates.manufacturer = updates.manufacturer;
    if (updates.unitCost !== undefined) partUpdates.standardCost = updates.unitCost;
    if (updates.minStockLevel !== undefined) partUpdates.minStockQty = updates.minStockLevel;
    if (updates.maxStockLevel !== undefined) partUpdates.maxStockQty = updates.maxStockLevel;
    if (updates.leadTimeDays !== undefined) partUpdates.leadTimeDays = updates.leadTimeDays;
    if (updates.isActive !== undefined) partUpdates.isActive = updates.isActive;

    if (Object.keys(partUpdates).length > 0) {
      await db.update(parts).set({ ...partUpdates, updatedAt: new Date() }).where(eq(parts.id, id));
    }

    if (updates.quantityOnHand !== undefined || updates.quantityReserved !== undefined || updates.location !== undefined || updates.unitCost !== undefined) {
      const stockUpdates: Partial<{ quantityOnHand: number; quantityReserved: number; unitCost: number; updatedAt: Date }> = { updatedAt: new Date() };
      if (updates.quantityOnHand !== undefined) stockUpdates.quantityOnHand = updates.quantityOnHand;
      if (updates.quantityReserved !== undefined) stockUpdates.quantityReserved = updates.quantityReserved;
      if (updates.unitCost !== undefined) stockUpdates.unitCost = updates.unitCost;

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
    if (!inv) { throw new Error(`Parts inventory ${id} not found`); }
    return inv;
  }

  async deletePartsInventory(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deletePartsInventory");
    await db.delete(stock).where(eq(stock.partId, id));
    const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id);
    await db.delete(parts).where(conditions);
  }

  async reserveParts(partId: string, quantity: number, workOrderId: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "reserveParts");
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) { throw new Error(`Inventory for part ${partId} not found`); }
    const available = inventory.quantityOnHand - (inventory.quantityReserved || 0);
    if (available < quantity) { throw new Error(`Insufficient stock for part ${partId}. Available: ${available}, Requested: ${quantity}`); }

    const [stockRow] = await db.select().from(stock).where(and(eq(stock.partId, partId), eq(stock.orgId, orgId))).limit(1);
    if (stockRow) {
      await db.update(stock).set({
        quantityReserved: (stockRow.quantityReserved ?? 0) + quantity,
        updatedAt: new Date(),
      }).where(eq(stock.id, stockRow.id));
    }
  }

  async releaseParts(partId: string, quantity: number, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "releaseParts");
    const [stockRow] = await db.select().from(stock).where(and(eq(stock.partId, partId), eq(stock.orgId, orgId))).limit(1);
    if (stockRow) {
      await db.update(stock).set({
        quantityReserved: Math.max(0, (stockRow.quantityReserved ?? 0) - quantity),
        updatedAt: new Date(),
      }).where(eq(stock.id, stockRow.id));
    }
  }

  async checkPartAvailability(partId: string, quantity: number, orgId: string): Promise<AvailabilityResult> {
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) { return { available: false, quantityOnHand: 0, quantityReserved: 0 }; }
    return { available: inventory.quantityOnHand - (inventory.quantityReserved || 0) >= quantity, quantityOnHand: inventory.quantityOnHand, quantityReserved: inventory.quantityReserved || 0 };
  }
}
