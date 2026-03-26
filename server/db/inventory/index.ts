/**
 * Inventory Repository
 *
 * Improvement #2: reservePartsForWorkOrder and releasePartsFromWorkOrder
 * now write inventory movement records so the audit trail is complete.
 * Previously only removePartAndRestoreInventory wrote movements.
 */

import { randomUUID } from "node:crypto";
import { eq, and, or, ilike, sql, desc, asc } from "drizzle-orm";
import { db } from "../../db-config";
import {
  workOrderParts,
  partsInventory,
  workOrderHistory,
  inventoryMovements,
  workOrders,
  stock,
  type WorkOrderParts,
  type InsertWorkOrderParts,
  type WorkOrderHistory,
  type InsertWorkOrderHistory,
  type InventoryMovement,
  type PartsInventory,
  type Stock,
} from "@shared/schema-runtime";
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
  async getStock(orgId?: string, search?: string, location?: string, sortBy?: string) { return this.stockStorage.getStock(orgId, search ? { search, location } : undefined); }
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

  override async getPartsInventory(category?: string, orgId?: string, search?: string, sortBy?: string, sortOrder?: "asc" | "desc"): Promise<PartsInventory[]> {
    const conditions: any[] = [];
    if (orgId) conditions.push(eq(partsInventory.orgId, orgId));
    if (category) conditions.push(eq(partsInventory.category, category));
    if (search) conditions.push(or(ilike(partsInventory.partName, `%${search}%`), ilike(partsInventory.partNumber, `%${search}%`)));
    const orderCol = sortBy === 'partName' ? partsInventory.partName : sortBy === 'category' ? partsInventory.category : partsInventory.partName;
    const orderFn = sortOrder === 'desc' ? desc(orderCol) : asc(orderCol);
    if (conditions.length > 0) return db.select().from(partsInventory).where(and(...conditions)).orderBy(orderFn);
    return db.select().from(partsInventory).orderBy(orderFn);
  }

  async getPartsInventoryPaginated(orgId: string, options: {
    limit?: number; offset?: number; search?: string; category?: string;
    criticality?: string; stockStatus?: string; supplier?: string;
    sortBy?: string; sortOrder?: "asc" | "desc";
  }): Promise<{ items: PartsInventory[]; total: number }> {
    const { limit = 25, offset = 0, search, category, criticality, stockStatus, sortBy, sortOrder } = options;
    const conditions: any[] = [eq(partsInventory.orgId, orgId)];
    if (category) conditions.push(eq(partsInventory.category, category));
    if (search) conditions.push(or(ilike(partsInventory.partName, `%${search}%`), ilike(partsInventory.partNumber, `%${search}%`)));

    const where = and(...conditions);
    const orderCol = sortBy === 'partName' ? partsInventory.partName : sortBy === 'category' ? partsInventory.category : sortBy === 'unitCost' ? partsInventory.unitCost : partsInventory.partName;
    const orderFn = sortOrder === 'desc' ? desc(orderCol) : asc(orderCol);

    let items = await db.select().from(partsInventory).where(where).orderBy(orderFn).limit(limit).offset(offset);

    if (stockStatus && stockStatus !== 'all') {
      items = items.filter(item => {
        const onHand = item.quantityOnHand || 0;
        const min = item.minStockLevel || 1;
        const max = item.maxStockLevel || 100;
        switch (stockStatus) {
          case 'zero': return onHand === 0;
          case 'critical': return onHand > 0 && onHand <= min;
          case 'low': return onHand > min && onHand <= (min * 2);
          case 'adequate': return onHand > (min * 2) && onHand <= max;
          case 'excess': return onHand > max;
          default: return true;
        }
      });
    }

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(partsInventory).where(where);
    return { items, total: Number(countResult?.count || 0) };
  }

  async getPartById(id: string, orgId?: string): Promise<PartsInventory | undefined> {
    const conditions = orgId ? and(eq(partsInventory.id, id), eq(partsInventory.orgId, orgId)) : eq(partsInventory.id, id);
    const [result] = await db.select().from(partsInventory).where(conditions);
    return result;
  }

  async getLowStockParts(orgId?: string): Promise<PartsInventory[]> {
    const conditions: any[] = [];
    if (orgId) conditions.push(eq(partsInventory.orgId, orgId));
    const all = conditions.length > 0
      ? await db.select().from(partsInventory).where(and(...conditions))
      : await db.select().from(partsInventory);
    return all.filter(p => p.quantityOnHand <= (p.minStockLevel || 1));
  }

  async reservePart(partId: string, quantity: number, orgId?: string): Promise<PartsInventory> {
    const conditions = orgId ? and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId)) : eq(partsInventory.id, partId);
    const [inv] = await db.select().from(partsInventory).where(conditions);
    if (!inv) throw new Error(`Part ${partId} not found`);
    const available = inv.quantityOnHand - (inv.quantityReserved || 0);
    if (available < quantity) throw new Error(`Insufficient stock for part ${partId}`);
    const [updated] = await db.update(partsInventory).set({
      quantityReserved: (inv.quantityReserved || 0) + quantity, updatedAt: new Date()
    }).where(conditions).returning();
    return updated;
  }

  async checkPartAvailabilityForWorkOrder(partId: string, quantity: number, orgId?: string): Promise<{ available: boolean; onHand: number; reserved: number }> {
    const conditions = orgId ? and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId)) : eq(partsInventory.id, partId);
    const [inv] = await db.select().from(partsInventory).where(conditions);
    if (!inv) return { available: false, onHand: 0, reserved: 0 };
    return { available: inv.quantityOnHand - (inv.quantityReserved || 0) >= quantity, onHand: inv.quantityOnHand, reserved: inv.quantityReserved || 0 };
  }

  async syncStockCostFromPart(partId: string): Promise<void> {
    const [inv] = await db.select().from(partsInventory).where(eq(partsInventory.id, partId));
    if (!inv) return;
    await db.update(stock).set({ unitCost: inv.unitCost, updatedAt: new Date() }).where(eq(stock.partId, partId));
  }

  async getStockByPartNumber(partNo: string, orgId?: string): Promise<Stock[]> {
    const conditions = orgId
      ? and(eq(stock.partNo, partNo), eq(stock.orgId, orgId))
      : eq(stock.partNo, partNo);
    return db.select().from(stock).where(conditions);
  }

  async updateStockQuantities(stockId: string, onHand?: number, reserved?: number, orgId?: string): Promise<Stock> {
    const updates: any = { updatedAt: new Date() };
    if (onHand !== undefined) updates.quantityOnHand = onHand;
    if (reserved !== undefined) updates.quantityReserved = reserved;
    const conditions = orgId ? and(eq(stock.id, stockId), eq(stock.orgId, orgId)) : eq(stock.id, stockId);
    const [updated] = await db.update(stock).set(updates).where(conditions).returning();
    if (!updated) throw new Error(`Stock ${stockId} not found`);
    return updated;
  }

  async addBulkPartsToWorkOrder(
    workOrderId: string,
    partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
    orgId: string
  ): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    const result = { added: [] as WorkOrderParts[], updated: [] as WorkOrderParts[], errors: [] as string[] };

    await db.transaction(async (tx) => {
      const existingParts = await tx.select().from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
      const existingMap = new Map(existingParts.map((p) => [p.partId, p]));

      for (const partToAdd of partsToAdd) {
        try {
          const [inventoryPart] = await tx.select().from(partsInventory)
            .where(and(eq(partsInventory.id, partToAdd.partId), eq(partsInventory.orgId, orgId))).limit(1);
          if (!inventoryPart) { result.errors.push(`Part ${partToAdd.partId} not found`); continue; }

          const unitCost = inventoryPart.unitCost || 0;
          const existing = existingMap.get(partToAdd.partId);

          if (existing) {
            const newQty = existing.quantityUsed + partToAdd.quantity;
            const [updated] = await tx.update(workOrderParts).set({
              quantityUsed: newQty, totalCost: newQty * unitCost,
              notes: partToAdd.notes
                ? existing.notes ? `${existing.notes}; ${partToAdd.notes}` : partToAdd.notes
                : existing.notes,
              updatedAt: new Date(),
            }).where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId))).returning();
            result.updated.push(updated);
            existingMap.set(partToAdd.partId, updated);
          } else {
            const [newPart] = await tx.insert(workOrderParts).values({
              id: randomUUID(), orgId, workOrderId, partId: partToAdd.partId,
              quantityUsed: partToAdd.quantity, unitCost, totalCost: partToAdd.quantity * unitCost,
              usedBy: partToAdd.usedBy, notes: partToAdd.notes, createdAt: new Date(), updatedAt: new Date(),
            }).returning();
            result.added.push(newPart);
            existingMap.set(partToAdd.partId, newPart);
          }
        } catch (err) {
          result.errors.push(`Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });

    return result;
  }

  /**
   * Improvement #2: now writes an inventoryMovements record for each reserved part
   * so the audit trail shows when and why quantities were reserved.
   */
  async reservePartsForWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");

    await db.transaction(async (tx) => {
      const woParts = await tx.select().from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

      const partQuantities = new Map<string, number>();
      for (const woPart of woParts) {
        partQuantities.set(woPart.partId, (partQuantities.get(woPart.partId) || 0) + woPart.quantityUsed);
      }

      for (const [partId, totalQty] of partQuantities.entries()) {
        const [inventory] = await tx.select().from(partsInventory)
          .where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId))).limit(1);
        if (!inventory) throw new Error(`Part ${partId} not found in inventory`);

        const available = inventory.quantityOnHand - (inventory.quantityReserved || 0);
        if (available < totalQty) {
          throw new Error(`Insufficient stock for part ${inventory.partName}: available=${available}, requested=${totalQty}`);
        }

        const newReserved = (inventory.quantityReserved || 0) + totalQty;
        await tx.update(partsInventory).set({ quantityReserved: newReserved, updatedAt: new Date() })
          .where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId)));

        // Improvement #2: write movement record for the reservation
        await tx.insert(inventoryMovements).values({
          id: randomUUID(), orgId, partId, workOrderId,
          movementType:   "reserve",
          quantity:        totalQty,
          quantityBefore:  inventory.quantityOnHand,
          quantityAfter:   inventory.quantityOnHand,
          reservedBefore:  inventory.quantityReserved || 0,
          reservedAfter:   newReserved,
          performedBy:     "system",
          notes:           `Reserved ${totalQty} units for work order ${workOrderId}`,
          createdAt:       new Date(),
        });
      }
    });
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
    orgId: string
  ): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    const result = { added: [] as WorkOrderParts[], updated: [] as WorkOrderParts[], errors: [] as string[] };

    await db.transaction(async (tx) => {
      const existingParts = await tx.select().from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
      const existingMap = new Map(existingParts.map((p) => [p.partId, p]));

      for (const partToAdd of partsToAdd) {
        try {
          const [inventoryPart] = await tx.select().from(partsInventory)
            .where(and(eq(partsInventory.id, partToAdd.partId), eq(partsInventory.orgId, orgId))).limit(1);
          if (!inventoryPart) { result.errors.push(`Part ${partToAdd.partId} not found`); continue; }

          const unitCost = inventoryPart.unitCost || 0;
          const existing = existingMap.get(partToAdd.partId);

          if (existing) {
            const newQty = existing.quantityUsed + partToAdd.quantity;
            const [updated] = await tx.update(workOrderParts).set({
              quantityUsed: newQty, totalCost: newQty * unitCost,
              notes: partToAdd.notes
                ? existing.notes ? `${existing.notes}; ${partToAdd.notes}` : partToAdd.notes
                : existing.notes,
              updatedAt: new Date(),
            }).where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId))).returning();
            result.updated.push(updated);
            existingMap.set(partToAdd.partId, updated);
          } else {
            const [newPart] = await tx.insert(workOrderParts).values({
              id: randomUUID(), orgId, workOrderId, partId: partToAdd.partId,
              quantityUsed: partToAdd.quantity, unitCost, totalCost: partToAdd.quantity * unitCost,
              usedBy: partToAdd.usedBy, notes: partToAdd.notes, createdAt: new Date(), updatedAt: new Date(),
            }).returning();
            result.added.push(newPart);
            existingMap.set(partToAdd.partId, newPart);
          }
        } catch (err) {
          result.errors.push(`Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Reserve stock atomically — include movement records
      if (result.added.length > 0 || result.updated.length > 0) {
        const allWoParts = await tx.select().from(workOrderParts)
          .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

        const partQuantities = new Map<string, number>();
        for (const woPart of allWoParts) {
          partQuantities.set(woPart.partId, (partQuantities.get(woPart.partId) || 0) + woPart.quantityUsed);
        }

        for (const [partId, totalQty] of partQuantities.entries()) {
          const [inventory] = await tx.select().from(partsInventory)
            .where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId))).limit(1);
          if (!inventory) throw new Error(`Part ${partId} not found in inventory`);

          const available = inventory.quantityOnHand - (inventory.quantityReserved || 0);
          if (available < totalQty) {
            throw new Error(`Insufficient stock for part ${inventory.partName}: available=${available}, requested=${totalQty}`);
          }

          const newReserved = (inventory.quantityReserved || 0) + totalQty;
          await tx.update(partsInventory).set({ quantityReserved: newReserved, updatedAt: new Date() })
            .where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId)));

          // Improvement #2: movement record inside the same transaction
          await tx.insert(inventoryMovements).values({
            id: randomUUID(), orgId, partId, workOrderId,
            movementType:   "reserve",
            quantity:        totalQty,
            quantityBefore:  inventory.quantityOnHand,
            quantityAfter:   inventory.quantityOnHand,
            reservedBefore:  inventory.quantityReserved || 0,
            reservedAfter:   newReserved,
            performedBy:     "system",
            notes:           `Reserved for work order ${workOrderId}`,
            createdAt:       new Date(),
          });
        }
      }
    });

    return result;
  }

  /**
   * Improvement #2: now writes inventory movement records for each released part.
   */
  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");

    await db.transaction(async (tx) => {
      const woParts = await tx.select().from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

      const partQuantities = new Map<string, number>();
      for (const woPart of woParts) {
        partQuantities.set(woPart.partId, (partQuantities.get(woPart.partId) || 0) + woPart.quantityUsed);
      }

      for (const [partId, totalQty] of partQuantities.entries()) {
        const [inventory] = await tx.select().from(partsInventory)
          .where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId))).limit(1);

        if (inventory) {
          const newReserved = Math.max(0, (inventory.quantityReserved || 0) - totalQty);
          await tx.update(partsInventory).set({ quantityReserved: newReserved, updatedAt: new Date() })
            .where(and(eq(partsInventory.id, partId), eq(partsInventory.orgId, orgId)));

          // Improvement #2: movement record for the release
          await tx.insert(inventoryMovements).values({
            id: randomUUID(), orgId, partId, workOrderId,
            movementType:   "release",
            quantity:        totalQty,
            quantityBefore:  inventory.quantityOnHand,
            quantityAfter:   inventory.quantityOnHand,
            reservedBefore:  inventory.quantityReserved || 0,
            reservedAfter:   newReserved,
            performedBy:     "system",
            notes:           `Released from work order ${workOrderId}`,
            createdAt:       new Date(),
          });
        }
      }
    });
  }

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    return db.select().from(workOrderHistory)
      .where(and(eq(workOrderHistory.workOrderId, workOrderId), eq(workOrderHistory.orgId, orgId)))
      .orderBy(sql`${workOrderHistory.createdAt} DESC`);
  }

  async addWorkOrderHistoryEntry(entry: InsertWorkOrderHistory): Promise<WorkOrderHistory> {
    const [newEntry] = await db.insert(workOrderHistory)
      .values({ id: randomUUID(), ...entry, createdAt: new Date() }).returning();
    return newEntry;
  }

  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<InventoryMovement[]> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    return db.select().from(inventoryMovements)
      .where(and(eq(inventoryMovements.workOrderId, workOrderId), eq(inventoryMovements.orgId, orgId)))
      .orderBy(sql`${inventoryMovements.createdAt} DESC`);
  }

  async getWorkOrderPartsByEquipment(orgId: string, equipmentId: string): Promise<WorkOrderParts[]> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    const result = await db.select({ workOrderParts }).from(workOrderParts)
      .innerJoin(workOrders, eq(workOrderParts.workOrderId, workOrders.id))
      .where(and(eq(workOrderParts.orgId, orgId), eq(workOrders.equipmentId, equipmentId)));
    return result.map((r) => r.workOrderParts);
  }

  async getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<WorkOrderParts[]> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    return db.select().from(workOrderParts)
      .where(and(eq(workOrderParts.partId, partId), eq(workOrderParts.orgId, orgId)));
  }

  async removePartFromWorkOrder(workOrderPartId: string, orgId?: string): Promise<void> {
    const conditions = orgId
      ? and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId))
      : eq(workOrderParts.id, workOrderPartId);
    await db.delete(workOrderParts).where(conditions);
  }

  async removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void> {
    if (!orgId) throw new Error("orgId is required for tenant isolation");
    await db.transaction(async (tx) => {
      const [woPart] = await tx.select().from(workOrderParts)
        .where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));
      if (!woPart) throw new Error(`Work order part ${workOrderPartId} not found`);

      const [inventory] = await tx.select().from(partsInventory)
        .where(and(eq(partsInventory.id, woPart.partId), eq(partsInventory.orgId, orgId)));
      if (!inventory) throw new Error(`Inventory for part ${woPart.partId} not found`);

      const newReserved = Math.max(0, (inventory.quantityReserved || 0) - woPart.quantityUsed);

      await tx.update(partsInventory).set({ quantityReserved: newReserved, updatedAt: new Date() })
        .where(and(eq(partsInventory.id, woPart.partId), eq(partsInventory.orgId, orgId)));

      await tx.insert(inventoryMovements).values({
        id: randomUUID(), orgId, partId: woPart.partId, workOrderId: woPart.workOrderId,
        movementType: "return", quantity: woPart.quantityUsed,
        quantityBefore: inventory.quantityOnHand, quantityAfter: inventory.quantityOnHand,
        reservedBefore: inventory.quantityReserved || 0, reservedAfter: newReserved,
        performedBy, notes: `Returned ${woPart.quantityUsed} units from work order`, createdAt: new Date(),
      });

      await tx.delete(workOrderParts)
        .where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));

      const [wo] = await tx.select().from(workOrders)
        .where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
      if (wo) {
        const remainingParts = await tx.select().from(workOrderParts)
          .where(and(eq(workOrderParts.workOrderId, woPart.workOrderId), eq(workOrderParts.orgId, orgId)));
        const totalPartsCost = remainingParts.reduce((sum, p) => sum + (p.totalCost || 0), 0);
        await tx.update(workOrders).set({
          totalPartsCost, totalCost: totalPartsCost + (wo.totalLaborCost || 0), updatedAt: new Date(),
        }).where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
      }
    });
  }

  async getPartsCostForWorkOrder(workOrderId: string): Promise<{ totalPartsCost: number; partsCount: number }> {
    const parts = await db.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, workOrderId));
    const totalPartsCost = parts.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    return { totalPartsCost, partsCount: parts.length };
  }
}

export const dbInventoryStorage = new DatabaseInventoryStorage();

console.log("[Inventory Repository] Loaded 6 modular files");
