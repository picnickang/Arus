import type { WidenPartial } from "../../lib/widen-partial";
/**
 * CANONICAL HOME — Inventory
 * ============================================================
 * This module is the single canonical home for Inventory data
 * access. Other layers (domain adapters under
 * `server/domains/inventory/infrastructure/`, legacy route handlers,
 * cross-domain readers in `server/composition/*`, etc.) MUST import
 * the `db…Storage` singleton from this file directly rather than
 * routing through `server/repositories.ts`. Push B4 (Repositories
 * Proxy Decomposition) removed the four primary-domain importers of
 * that proxy; the proxy now exists only as a transitional re-export
 * barrel for legacy non-domain consumers. New code MUST import from
 * here.
 * ============================================================
 */
/**
 * Inventory Repository
 *
 * FIXES APPLIED:
 * - Use DbTransaction type alias from db-config (was: Parameters<Parameters<typeof db.transaction>[0]>[0])
 * - Tighten return type of getStock wrapper (options shape was incorrect)
 * - Explicit types on .map/.reduce/.filter callbacks where inference fails
 * - Map.entries() iteration uses Array.from() for ES2015 target compatibility
 * - Keep `partNo` reference (parts table DOES have this column — schema-runtime.ts
 *   cast fix makes it visible)
 *
 * DEPENDS ON:
 * - db-config.ts patch (adds DbTransaction type, casts db Proxy to concrete type)
 * - schema-runtime.ts fix (as typeof pgSchema.<table> cast pattern)
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Inventory:Index");
import { randomUUID } from "node:crypto";
import { eq, and, or, ilike, sql, desc, type SQL } from "drizzle-orm";
import { db } from "../../db-config";
import {
  workOrderParts,
  workOrderHistory,
  inventoryMovements,
  workOrders,
  stock,
  parts as partsTable,
} from "@shared/schema-runtime";
import type {
  WorkOrderParts,
  WorkOrderHistory,
  InsertWorkOrderHistory,
  InventoryMovement,
  PartsInventory,
  Stock,
  InsertStock,
  InsertSupplier,
  InsertPartSubstitution,
} from "@shared/schema-runtime";
import { DbPartsStorage, partAndStockToPartsInventory } from "./db-parts.js";
import { DbStockStorage } from "./db-stock.js";
import { partAndStockAsPartsInventory as partAndStockAsPartsInventoryQuery } from "./parts-inventory-query.js";
import {
  addBulkPartsAndReserveInventory as addBulkPartsAndReserveInventoryForWorkOrder,
  addBulkPartsToWorkOrder as addBulkPartsToWorkOrderRows,
  releasePartsFromWorkOrder as releaseWorkOrderPartReservations,
  removePartAndRestoreInventory as removeWorkOrderPartAndRestoreInventory,
  reservePartsForWorkOrder as reserveWorkOrderParts,
} from "./work-order-parts.js";

export * from "./types.js";
export { fireInventoryMovementProjections } from "./inventory-projections.js";
export type { PendingMovementProjection } from "./inventory-projections.js";

// StockFilters used by DbStockStorage.getStock
interface StockFilters {
  search?: string | undefined;
  location?: string | undefined;
}

export class DatabaseInventoryStorage extends DbPartsStorage {
  private stockStorage = new DbStockStorage();

  async getPartStockWithSupplierLeadTime(partId: string, orgId: string) {
    return this.stockStorage.getPartStockWithSupplierLeadTime(partId, orgId);
  }
  async getSuppliers(orgId?: string) {
    return this.stockStorage.getSuppliers(orgId);
  }
  async getSupplier(id: string, orgId?: string) {
    return this.stockStorage.getSupplier(id, orgId);
  }
  async createSupplier(data: InsertSupplier) {
    return this.stockStorage.createSupplier(data);
  }
  async updateSupplier(id: string, updates: WidenPartial<InsertSupplier>, orgId?: string) {
    return this.stockStorage.updateSupplier(id, updates, orgId);
  }
  async deleteSupplier(id: string, orgId?: string) {
    return this.stockStorage.deleteSupplier(id, orgId);
  }
  async getStock(orgId?: string, search?: string, location?: string, _sortBy?: string) {
    const filters: StockFilters | undefined = search ? { search, location } : undefined;
    return this.stockStorage.getStock(orgId, filters);
  }
  async createStock(data: InsertStock) {
    return this.stockStorage.createStock(data);
  }
  async updateStock(id: string, updates: WidenPartial<InsertStock>, orgId?: string) {
    return this.stockStorage.updateStock(id, updates, orgId);
  }
  async deleteStock(id: string, orgId?: string) {
    return this.stockStorage.deleteStock(id, orgId);
  }
  async getPartSubstitutions(partId: string, orgId: string) {
    return this.stockStorage.getPartSubstitutions(partId, orgId);
  }
  async createPartSubstitution(sub: InsertPartSubstitution) {
    return this.stockStorage.createPartSubstitution(sub);
  }
  async suggestPartSubstitutions(partId: string, orgId: string) {
    return this.stockStorage.suggestPartSubstitutions(partId, orgId);
  }
  async getPartByPartNo(partNo: string, orgId?: string) {
    return this.stockStorage.getPartByPartNo(partNo, orgId);
  }
  async getPartsByNumbers(partNumbers: string[], orgId: string) {
    return this.stockStorage.getPartsByNumbers(partNumbers, orgId);
  }
  async deletePartCatalog(id: string) {
    return this.stockStorage.deletePartCatalog(id);
  }
  async syncPartCostToStock(partId: string) {
    return this.stockStorage.syncPartCostToStock(partId);
  }
  async getStockByPart(partId: string, orgId?: string) {
    return this.stockStorage.getStockByPart(partId, orgId);
  }
  async getStockByParts(partIds: string[], orgId: string) {
    return this.stockStorage.getStockByParts(partIds, orgId);
  }
  async getPartSubstitutionsByPartNo(partNo: string, orgId?: string) {
    return this.stockStorage.getPartSubstitutionsByPartNo(partNo, orgId);
  }
  async deletePartSubstitution(id: string) {
    return this.stockStorage.deletePartSubstitution(id);
  }
  async seedStockForParts(orgId?: string) {
    return this.stockStorage.seedStockForParts(orgId);
  }

  override async getPartsInventory(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PartsInventory[]> {
    return partAndStockAsPartsInventoryQuery(orgId, { category, search, sortBy, sortOrder });
  }

  async getPartsInventoryPaginated(
    orgId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      category?: string;
      criticality?: string;
      stockStatus?: string;
      supplier?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<{ items: PartsInventory[]; total: number }> {
    const { limit = 25, offset = 0, search, category, stockStatus, sortBy, sortOrder } = options;

    const stockStatusFilter = (item: PartsInventory): boolean => {
      if (!stockStatus || stockStatus === "all") {
        return true;
      }
      const onHand = item.quantityOnHand || 0;
      const min = item.minStockLevel || 1;
      const max = item.maxStockLevel || 100;
      switch (stockStatus) {
        case "zero":
          return onHand === 0;
        case "critical":
          return onHand > 0 && onHand <= min;
        case "low":
          return onHand > min && onHand <= min * 2;
        case "adequate":
          return onHand > min * 2 && onHand <= max;
        case "excess":
          return onHand > max;
        default:
          return true;
      }
    };

    if (stockStatus && stockStatus !== "all") {
      const allItems = await partAndStockAsPartsInventoryQuery(orgId, {
        category,
        search,
        sortBy,
        sortOrder,
      });
      const filtered = allItems.filter(stockStatusFilter);
      return { items: filtered.slice(offset, offset + limit), total: filtered.length };
    }

    const items = await partAndStockAsPartsInventoryQuery(orgId, {
      category,
      search,
      sortBy,
      sortOrder,
      limit,
      offset,
    });
    const pConditions: SQL<unknown>[] = [eq(partsTable.orgId, orgId)];
    if (category) {
      pConditions.push(eq(partsTable.category, category));
    }
    if (search) {
      const searchCond = or(
        ilike(partsTable.name, `%${search}%`),
        ilike(partsTable.partNo, `%${search}%`)
      );
      if (searchCond) {
        pConditions.push(searchCond);
      }
    }
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(partsTable)
      .where(and(...pConditions));
    return { items, total: Number(countResult?.count || 0) };
  }

  async getPartById(id: string, orgId?: string): Promise<PartsInventory | undefined> {
    const conditions = orgId
      ? and(eq(partsTable.id, id), eq(partsTable.orgId, orgId))
      : eq(partsTable.id, id);
    const rows = await db
      .select()
      .from(partsTable)
      .leftJoin(stock, eq(partsTable.id, stock.partId))
      .where(conditions);
    if (rows.length === 0) {
      return undefined;
    }
    const stockRows = rows.map((r) => r.stock).filter((s): s is Stock => s !== null);
    const first = rows[0];
    if (!first) {
      return undefined;
    }
    return partAndStockToPartsInventory(first.parts, stockRows);
  }

  async getLowStockParts(orgId?: string): Promise<PartsInventory[]> {
    const all = await partAndStockAsPartsInventoryQuery(orgId);
    return all.filter((p) => p.quantityOnHand <= (p.minStockLevel || 1));
  }

  async reservePart(partId: string, quantity: number, orgId?: string): Promise<PartsInventory> {
    const conditions = orgId
      ? and(eq(stock.partId, partId), eq(stock.orgId, orgId))
      : eq(stock.partId, partId);
    const allStock = await db
      .select()
      .from(stock)
      .where(conditions)
      .orderBy(sql`(${stock.quantityOnHand} - ${stock.quantityReserved}) DESC`);
    if (allStock.length === 0) {
      throw new Error(`Part ${partId} not found in stock`);
    }
    const totalAvailable = allStock.reduce(
      (sum: number, s: Stock) =>
        sum + Math.max(0, (s.quantityOnHand ?? 0) - (s.quantityReserved ?? 0)),
      0
    );
    if (totalAvailable < quantity) {
      throw new Error(`Insufficient stock for part ${partId}`);
    }
    let remaining = quantity;
    for (const row of allStock) {
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
    const result = await this.getPartById(partId, orgId);
    if (!result) {
      throw new Error(`Part ${partId} not found`);
    }
    return result;
  }

  async checkPartAvailabilityForWorkOrder(
    partId: string,
    quantity: number,
    orgId?: string
  ): Promise<{ available: boolean; onHand: number; reserved: number }> {
    const conditions = orgId
      ? and(eq(stock.partId, partId), eq(stock.orgId, orgId))
      : eq(stock.partId, partId);
    const allStock = await db.select().from(stock).where(conditions);
    if (allStock.length === 0) {
      return { available: false, onHand: 0, reserved: 0 };
    }
    const onHand = allStock.reduce((sum: number, s: Stock) => sum + (s.quantityOnHand ?? 0), 0);
    const reserved = allStock.reduce((sum: number, s: Stock) => sum + (s.quantityReserved ?? 0), 0);
    return { available: onHand - reserved >= quantity, onHand, reserved };
  }

  async syncStockCostFromPart(partId: string): Promise<void> {
    const [part] = await db.select().from(partsTable).where(eq(partsTable.id, partId));
    if (!part) {
      return;
    }
    await db
      .update(stock)
      .set({ unitCost: part.standardCost, updatedAt: new Date() })
      .where(eq(stock.partId, partId));
  }

  async getStockByPartNumber(partNo: string, orgId?: string): Promise<Stock[]> {
    const conditions = orgId
      ? and(eq(stock.partNo, partNo), eq(stock.orgId, orgId))
      : eq(stock.partNo, partNo);
    return db.select().from(stock).where(conditions);
  }

  async updateStockQuantities(
    stockId: string,
    onHand?: number,
    reserved?: number,
    orgId?: string
  ): Promise<Stock> {
    const updates: Partial<{ quantityOnHand: number; quantityReserved: number; updatedAt: Date }> =
      {
        updatedAt: new Date(),
      };
    if (onHand !== undefined) {
      updates.quantityOnHand = onHand;
    }
    if (reserved !== undefined) {
      updates.quantityReserved = reserved;
    }
    const conditions = orgId
      ? and(eq(stock.id, stockId), eq(stock.orgId, orgId))
      : eq(stock.id, stockId);
    const [updated] = await db.update(stock).set(updates).where(conditions).returning();
    if (!updated) {
      throw new Error(`Stock ${stockId} not found`);
    }
    return updated;
  }

  async addBulkPartsToWorkOrder(
    workOrderId: string,
    partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
    orgId: string
  ): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    return addBulkPartsToWorkOrderRows(workOrderId, partsToAdd, orgId);
  }

  async reservePartsForWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    return reserveWorkOrderParts(workOrderId, orgId);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
    orgId: string
  ): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    return addBulkPartsAndReserveInventoryForWorkOrder(workOrderId, partsToAdd, orgId);
  }

  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    return releaseWorkOrderPartReservations(workOrderId, orgId);
  }

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    return db
      .select()
      .from(workOrderHistory)
      .where(and(eq(workOrderHistory.workOrderId, workOrderId), eq(workOrderHistory.orgId, orgId)))
      .orderBy(desc(workOrderHistory.createdAt));
  }

  async addWorkOrderHistoryEntry(entry: InsertWorkOrderHistory): Promise<WorkOrderHistory> {
    const [newEntry] = await db
      .insert(workOrderHistory)
      .values({ id: randomUUID(), ...entry, createdAt: new Date() })
      .returning();
    if (!newEntry) {
      throw new Error("Failed to add work order history entry");
    }
    return newEntry;
  }

  async getInventoryMovementsByWorkOrder(
    workOrderId: string,
    orgId: string
  ): Promise<InventoryMovement[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    return db
      .select()
      .from(inventoryMovements)
      .where(
        and(eq(inventoryMovements.workOrderId, workOrderId), eq(inventoryMovements.orgId, orgId))
      )
      .orderBy(desc(inventoryMovements.createdAt));
  }

  async getWorkOrderPartsByEquipment(
    orgId: string,
    equipmentId: string
  ): Promise<WorkOrderParts[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const result = await db
      .select({ workOrderParts })
      .from(workOrderParts)
      .innerJoin(workOrders, eq(workOrderParts.workOrderId, workOrders.id))
      .where(and(eq(workOrderParts.orgId, orgId), eq(workOrders.equipmentId, equipmentId)));
    return result.map((r) => r.workOrderParts);
  }

  async getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<WorkOrderParts[]> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    return db
      .select()
      .from(workOrderParts)
      .where(and(eq(workOrderParts.partId, partId), eq(workOrderParts.orgId, orgId)));
  }

  async removePartFromWorkOrder(workOrderPartId: string, orgId?: string): Promise<void> {
    const conditions = orgId
      ? and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId))
      : eq(workOrderParts.id, workOrderPartId);
    await db.delete(workOrderParts).where(conditions);
  }

  async removePartAndRestoreInventory(
    workOrderPartId: string,
    orgId: string,
    performedBy: string
  ): Promise<void> {
    return removeWorkOrderPartAndRestoreInventory(workOrderPartId, orgId, performedBy);
  }

  async getPartsCostForWorkOrder(
    workOrderId: string
  ): Promise<{ totalPartsCost: number; partsCount: number }> {
    const parts = await db
      .select()
      .from(workOrderParts)
      .where(eq(workOrderParts.workOrderId, workOrderId));
    const totalPartsCost = parts.reduce(
      (sum: number, p: WorkOrderParts) => sum + (p.totalCost || 0),
      0
    );
    return { totalPartsCost, partsCount: parts.length };
  }
}

export const dbInventoryStorage = new DatabaseInventoryStorage();

logger.info("[Inventory Repository] Loaded 6 modular files");
