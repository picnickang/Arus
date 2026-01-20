/**
 * Inventory Repository - Modular Aggregator
 */

import { randomUUID } from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { workOrderParts, partsInventory, workOrderHistory, inventoryMovements, workOrders, type WorkOrderParts, type InsertWorkOrderParts, type WorkOrderHistory, type InsertWorkOrderHistory, type InventoryMovement } from "@shared/schema-runtime";
import { DbPartsStorage } from "./db-parts.js";
import { DbStockStorage } from "./db-stock.js";

export * from "./types.js";
export { DbPartsStorage } from "./db-parts.js";
export { DbStockStorage } from "./db-stock.js";

export class DatabaseInventoryStorage extends DbPartsStorage {
  private stockStorage = new DbStockStorage();
  async getPartStockWithSupplierLeadTime(partId: string, orgId: string) { return this.stockStorage.getPartStockWithSupplierLeadTime(partId, orgId); }
  async getSuppliers(orgId?: string) { return this.stockStorage.getSuppliers(orgId); }
  async getSupplier(id: string, orgId?: string) { return this.stockStorage.getSupplier(id, orgId); }
  async createSupplier(data: any) { return this.stockStorage.createSupplier(data); }
  async updateSupplier(id: string, updates: any, orgId?: string) { return this.stockStorage.updateSupplier(id, updates, orgId); }
  async deleteSupplier(id: string, orgId?: string) { return this.stockStorage.deleteSupplier(id, orgId); }
  async getStock(orgId?: string, filters?: any) { return this.stockStorage.getStock(orgId, filters); }
  async createStock(data: any) { return this.stockStorage.createStock(data); }
  async updateStock(id: string, updates: any, orgId?: string) { return this.stockStorage.updateStock(id, updates, orgId); }
  async deleteStock(id: string, orgId?: string) { return this.stockStorage.deleteStock(id, orgId); }
  async getPartSubstitutions(partId: string, orgId: string) { return this.stockStorage.getPartSubstitutions(partId, orgId); }
  async createPartSubstitution(sub: any) { return this.stockStorage.createPartSubstitution(sub); }
  async suggestPartSubstitutions(partId: string, orgId: string) { return this.stockStorage.suggestPartSubstitutions(partId, orgId); }
  async getPartByPartNo(partNo: string, orgId?: string) { return this.stockStorage.getPartByPartNo(partNo, orgId); }
  async getPartsByNumbers(partNumbers: string[], orgId: string) { return this.stockStorage.getPartsByNumbers(partNumbers, orgId); }
  async deletePartCatalog(id: string) { return this.stockStorage.deletePartCatalog(id); }
  async syncPartCostToStock(partId: string) { return this.stockStorage.syncPartCostToStock(partId); }
  async getStockByPart(partId: string, orgId?: string) { return this.stockStorage.getStockByPart(partId, orgId); }
  async getStockByParts(partIds: string[], orgId: string) { return this.stockStorage.getStockByParts(partIds, orgId); }
  async getPartSubstitutionsByPartNo(partNo: string, orgId?: string) { return this.stockStorage.getPartSubstitutionsByPartNo(partNo, orgId); }
  async deletePartSubstitution(id: string) { return this.stockStorage.deletePartSubstitution(id); }
  async seedStockForParts(orgId?: string) { return this.stockStorage.seedStockForParts(orgId); }

  async addBulkPartsToWorkOrder(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    const result: { added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] } = { added: [], updated: [], errors: [] };
    
    await db.transaction(async (tx) => {
      const existingParts = await tx.select().from(workOrderParts).where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
      const existingMap = new Map(existingParts.map(p => [p.partId, p]));
      
      for (const partToAdd of partsToAdd) {
        try {
          const [inventoryPart] = await tx.select().from(partsInventory).where(and(eq(partsInventory.id, partToAdd.partId), eq(partsInventory.orgId, orgId))).limit(1);
          if (!inventoryPart) { result.errors.push(`Part ${partToAdd.partId} not found or not accessible`); continue; }
          const unitCost = inventoryPart.unitCost || 0;
          const existing = existingMap.get(partToAdd.partId);
          if (existing) {
            const newQty = existing.quantityUsed + partToAdd.quantity;
            const [updated] = await tx.update(workOrderParts).set({ quantityUsed: newQty, totalCost: newQty * unitCost, notes: partToAdd.notes ? (existing.notes ? `${existing.notes}; ${partToAdd.notes}` : partToAdd.notes) : existing.notes, updatedAt: new Date() }).where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId))).returning();
            result.updated.push(updated);
            existingMap.set(partToAdd.partId, updated);
          } else {
            const [newPart] = await tx.insert(workOrderParts).values({ id: randomUUID(), orgId, workOrderId, partId: partToAdd.partId, quantityUsed: partToAdd.quantity, unitCost, totalCost: partToAdd.quantity * unitCost, usedBy: partToAdd.usedBy, notes: partToAdd.notes, createdAt: new Date(), updatedAt: new Date() }).returning();
            result.added.push(newPart);
            existingMap.set(partToAdd.partId, newPart);
          }
        } catch (err) { result.errors.push(`Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`); }
      }
    });
    return result;
  }

  async reservePartsForWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    await db.transaction(async (tx) => {
      const woParts = await tx.select().from(workOrderParts).where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
      
      const partQuantities = new Map<string, number>();
      for (const woPart of woParts) {
        const current = partQuantities.get(woPart.partId) || 0;
        partQuantities.set(woPart.partId, current + woPart.quantityUsed);
      }
      
      for (const [partId, totalQty] of partQuantities.entries()) {
        const [inventory] = await tx.select().from(partsInventory).where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId))).limit(1);
        if (!inventory) { throw new Error(`Part ${partId} not found in inventory`); }
        const available = inventory.quantityOnHand - (inventory.quantityReserved || 0);
        if (available < totalQty) { throw new Error(`Insufficient stock for part ${inventory.partName}: available=${available}, requested=${totalQty}`); }
        await tx.update(partsInventory).set({ quantityReserved: (inventory.quantityReserved || 0) + totalQty, updatedAt: new Date() }).where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId)));
      }
    });
  }

  async addBulkPartsAndReserveInventory(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    const result = await this.addBulkPartsToWorkOrder(workOrderId, partsToAdd, orgId);
    if (result.added.length > 0 || result.updated.length > 0) {
      await this.reservePartsForWorkOrder(workOrderId, orgId);
    }
    return result;
  }

  async releasePartsFromWorkOrder(workOrderId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const woParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, workOrderId));
      
      const partQuantities = new Map<string, number>();
      for (const woPart of woParts) {
        const current = partQuantities.get(woPart.partId) || 0;
        partQuantities.set(woPart.partId, current + woPart.quantityUsed);
      }
      
      for (const [partId, totalQty] of partQuantities.entries()) {
        const [inventory] = await tx.select().from(partsInventory).where(eq(partsInventory.id, partId)).limit(1);
        if (inventory) {
          const newReserved = Math.max(0, (inventory.quantityReserved || 0) - totalQty);
          await tx.update(partsInventory).set({ quantityReserved: newReserved, updatedAt: new Date() }).where(eq(partsInventory.id, partId));
        }
      }
    });
  }

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    return db.select().from(workOrderHistory).where(and(eq(workOrderHistory.workOrderId, workOrderId), eq(workOrderHistory.orgId, orgId))).orderBy(sql`${workOrderHistory.createdAt} DESC`);
  }

  async addWorkOrderHistoryEntry(entry: InsertWorkOrderHistory): Promise<WorkOrderHistory> {
    const [newEntry] = await db.insert(workOrderHistory).values({ id: randomUUID(), ...entry, createdAt: new Date() }).returning();
    return newEntry;
  }

  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<InventoryMovement[]> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    return db.select().from(inventoryMovements).where(and(eq(inventoryMovements.workOrderId, workOrderId), eq(inventoryMovements.orgId, orgId))).orderBy(sql`${inventoryMovements.createdAt} DESC`);
  }

  async getWorkOrderPartsByEquipment(orgId: string, equipmentId: string): Promise<WorkOrderParts[]> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    const result = await db.select({ workOrderParts }).from(workOrderParts).innerJoin(workOrders, eq(workOrderParts.workOrderId, workOrders.id)).where(and(eq(workOrderParts.orgId, orgId), eq(workOrders.equipmentId, equipmentId)));
    return result.map(r => r.workOrderParts);
  }

  async getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<WorkOrderParts[]> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    return db.select().from(workOrderParts).where(and(eq(workOrderParts.partId, partId), eq(workOrderParts.orgId, orgId)));
  }

  async removePartFromWorkOrder(workOrderPartId: string, orgId?: string): Promise<void> {
    const conditions = orgId ? and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)) : eq(workOrderParts.id, workOrderPartId);
    await db.delete(workOrderParts).where(conditions);
  }

  async removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void> {
    if (!orgId) { throw new Error("orgId is required for tenant isolation"); }
    await db.transaction(async (tx) => {
      const [woPart] = await tx.select().from(workOrderParts).where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));
      if (!woPart) { throw new Error(`Work order part ${workOrderPartId} not found or not accessible`); }
      
      const [inventory] = await tx.select().from(partsInventory).where(and(eq(partsInventory.id, woPart.partId), eq(partsInventory.orgId, orgId)));
      if (!inventory) { throw new Error(`Inventory for part ${woPart.partId} not found`); }
      
      const quantityBefore = inventory.quantityOnHand;
      const reservedBefore = inventory.quantityReserved || 0;
      const newReserved = Math.max(0, reservedBefore - woPart.quantityUsed);
      
      await tx.update(partsInventory).set({ quantityReserved: newReserved, updatedAt: new Date() }).where(and(eq(partsInventory.id, woPart.partId), eq(partsInventory.orgId, orgId)));
      
      await tx.insert(inventoryMovements).values({
        id: randomUUID(), orgId, partId: woPart.partId, workOrderId: woPart.workOrderId,
        movementType: "return", quantity: woPart.quantityUsed,
        quantityBefore, quantityAfter: quantityBefore, reservedBefore, reservedAfter: newReserved,
        performedBy, notes: `Returned ${woPart.quantityUsed} units from work order`, createdAt: new Date()
      });
      
      await tx.delete(workOrderParts).where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));
      
      const [wo] = await tx.select().from(workOrders).where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
      if (wo) {
        const remainingParts = await tx.select().from(workOrderParts).where(and(eq(workOrderParts.workOrderId, woPart.workOrderId), eq(workOrderParts.orgId, orgId)));
        const totalPartsCost = remainingParts.reduce((sum, p) => sum + (p.totalCost || 0), 0);
        await tx.update(workOrders).set({ totalPartsCost, totalCost: totalPartsCost + (wo.totalLaborCost || 0), updatedAt: new Date() }).where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
      }
    });
  }

  async getPartsCostForWorkOrder(workOrderId: string): Promise<{ totalPartsCost: number; partsCount: number }> {
    const parts = await db.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, workOrderId));
    let totalPartsCost = 0;
    for (const p of parts) { totalPartsCost += p.totalCost || 0; }
    return { totalPartsCost, partsCount: parts.length };
  }
}

export const dbInventoryStorage = new DatabaseInventoryStorage();

console.log("[Inventory Repository] Loaded 6 modular files");
