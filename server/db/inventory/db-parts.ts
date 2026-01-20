/**
 * Inventory - Database Storage Parts & Inventory
 */

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../../db-config";
import { parts, partsInventory, type Part, type InsertPart, type PartsInventory, type InsertPartsInventory } from "@shared/schema-runtime";
import type { PartFilters, AvailabilityResult } from "./types.js";

export class DbPartsStorage {
  private validateOrgId(orgId: string | undefined, method: string): void { if (!orgId) {console.warn(`[${method}] Missing orgId - potential security issue`);} }

  async getParts(orgId?: string, filters?: PartFilters): Promise<Part[]> {
    const conditions: any[] = [];
    if (orgId) { conditions.push(eq(parts.orgId, orgId)); }
    if (filters?.category) { conditions.push(eq(parts.category, filters.category)); }
    if (conditions.length > 0) { return db.select().from(parts).where(and(...conditions)).orderBy(parts.name); }
    return db.select().from(parts).orderBy(parts.name);
  }

  async getPart(id: string, orgId?: string): Promise<Part | undefined> { const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id); const [result] = await db.select().from(parts).where(conditions); return result; }
  async getPartByPartNumber(partNumber: string, orgId: string): Promise<Part | undefined> { this.validateOrgId(orgId, "getPartByPartNumber"); const [result] = await db.select().from(parts).where(and(eq(parts.partNumber, partNumber), eq(parts.orgId, orgId))); return result; }
  async createPart(partData: InsertPart): Promise<Part> { const [newPart] = await db.insert(parts).values({ id: randomUUID(), ...partData, createdAt: new Date(), updatedAt: new Date() }).returning(); return newPart; }
  async updatePart(id: string, updates: Partial<InsertPart>, orgId?: string): Promise<Part> { this.validateOrgId(orgId, "updatePart"); const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id); const [updated] = await db.update(parts).set({ ...updates, updatedAt: new Date() }).where(conditions).returning(); if (!updated) {throw new Error(`Part ${id} not found`);} return updated; }
  async deletePart(id: string, orgId?: string): Promise<void> { this.validateOrgId(orgId, "deletePart"); const conditions = orgId ? and(eq(parts.id, id), eq(parts.orgId, orgId)) : eq(parts.id, id); await db.delete(parts).where(conditions); }

  async getPartsInventory(orgId?: string): Promise<PartsInventory[]> { if (orgId) {return db.select().from(partsInventory).where(eq(partsInventory.orgId, orgId));} return db.select().from(partsInventory); }
  async getPartsInventoryByPart(partId: string, orgId?: string): Promise<PartsInventory | undefined> { const conditions = orgId ? and(eq(partsInventory.partId, partId), eq(partsInventory.orgId, orgId)) : eq(partsInventory.partId, partId); const [result] = await db.select().from(partsInventory).where(conditions); return result; }
  async createPartsInventory(inventory: InsertPartsInventory): Promise<PartsInventory> { const [n] = await db.insert(partsInventory).values({ id: randomUUID(), ...inventory, quantityReserved: inventory.quantityReserved || 0, createdAt: new Date(), updatedAt: new Date() }).returning(); return n; }
  async updatePartsInventory(id: string, updates: Partial<InsertPartsInventory>): Promise<PartsInventory> { const [updated] = await db.update(partsInventory).set({ ...updates, updatedAt: new Date() }).where(eq(partsInventory.id, id)).returning(); if (!updated) {throw new Error(`Parts inventory ${id} not found`);} return updated; }
  async deletePartsInventory(id: string, orgId?: string): Promise<void> { this.validateOrgId(orgId, "deletePartsInventory"); const conditions = orgId ? and(eq(partsInventory.id, id), eq(partsInventory.orgId, orgId)) : eq(partsInventory.id, id); await db.delete(partsInventory).where(conditions); }

  async reserveParts(partId: string, quantity: number, workOrderId: string, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "reserveParts");
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) { throw new Error(`Inventory for part ${partId} not found`); }
    const available = inventory.quantityOnHand - (inventory.quantityReserved || 0);
    if (available < quantity) { throw new Error(`Insufficient stock for part ${partId}. Available: ${available}, Requested: ${quantity}`); }
    await this.updatePartsInventory(inventory.id, { quantityReserved: (inventory.quantityReserved || 0) + quantity });
  }

  async releaseParts(partId: string, quantity: number, orgId: string): Promise<void> {
    this.validateOrgId(orgId, "releaseParts");
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) { throw new Error(`Inventory for part ${partId} not found`); }
    await this.updatePartsInventory(inventory.id, { quantityReserved: Math.max(0, (inventory.quantityReserved || 0) - quantity) });
  }

  async checkPartAvailability(partId: string, quantity: number, orgId: string): Promise<AvailabilityResult> {
    const inventory = await this.getPartsInventoryByPart(partId, orgId);
    if (!inventory) { return { available: false, quantityOnHand: 0, quantityReserved: 0 }; }
    return { available: inventory.quantityOnHand - (inventory.quantityReserved || 0) >= quantity, quantityOnHand: inventory.quantityOnHand, quantityReserved: inventory.quantityReserved || 0 };
  }
}
