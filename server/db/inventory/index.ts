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
import { projectInventoryMovement } from "../../graph/projector";
import { eq, and, or, ilike, sql, desc, asc, type SQL } from "drizzle-orm";
import { db, type DbTransaction } from "../../db-config";
import {
  workOrderParts,
  workOrderHistory,
  inventoryMovements,
  workOrders,
  stock,
  parts as partsTable,
} from "@shared/schema-runtime";
import { failureHistory } from "@shared/schema-runtime";
import type {
  WorkOrderParts,
  WorkOrderHistory,
  InsertWorkOrderHistory,
  InventoryMovement,
  PartsInventory,
  Part,
  Stock,
  InsertStock,
  InsertSupplier,
  InsertPartSubstitution,
} from "@shared/schema-runtime";
import { DbPartsStorage, partAndStockToPartsInventory } from "./db-parts.js";
import { DbStockStorage } from "./db-stock.js";

/**
 * Push A2 — Pending graph projection captured INSIDE a DB transaction
 * but FIRED only after the transaction commits. The reviewer caught
 * the original in-tx fire-and-forget as a divergence hazard: if the
 * SQL transaction rolls back, in-flight graph writes would leave the
 * graph ahead of relational truth. The post-commit pattern below
 * guarantees the graph only ever reflects committed rows.
 *
 * Supplier / part name are resolved lazily here (post-commit) by a
 * single batched lookup against the `parts` table so the SUPPLIED_BY
 * edge is populated on live writes — backfill is no longer the only
 * path that produces supplier linkage.
 */
export interface PendingMovementProjection {
  movementId: string;
  partId: string;
  workOrderId: string | null | undefined;
  /**
   * Movement direction. Only forward-consumption types ('reserve',
   * 'consume') count toward REQUIRES_PART semantics. 'release' /
   * 'return' are reversals and must NOT contribute to the
   * failure→part edge (otherwise the live path would flip-count
   * vs. the backfill, which the reviewer flagged on the fourth
   * pass).
   */
  movementType: string;
}

export async function fireInventoryMovementProjections(
  orgId: string,
  pending: PendingMovementProjection[]
): Promise<void> {
  return fireProjectionsAfterCommit(orgId, pending);
}

async function fireProjectionsAfterCommit(
  orgId: string,
  pending: PendingMovementProjection[]
): Promise<void> {
  if (pending.length === 0) {
    return;
  }
  try {
    const partIds = Array.from(new Set(pending.map((p) => p.partId)));
    // Statically imported `partsTable` (was dynamic import + escape-hatch cast
    // shape — reviewer asked for typed schema bindings on this hot
    // path). Drizzle infers column types from the schema runtime
    // module directly.
    const partRows = await db
      .select({
        id: partsTable.id,
        name: partsTable.name,
        primarySupplierId: partsTable.primarySupplierId,
      })
      .from(partsTable)
      .where(and(eq(partsTable.orgId, orgId), sql`${partsTable.id} = ANY(${partIds})`));
    const partMeta = new Map<string, { name?: string | null; supplierId?: string | null }>();
    for (const r of partRows as Array<{
      id: string;
      name: string | null;
      primarySupplierId: string | null;
    }>) {
      partMeta.set(r.id, {
        name: r.name,
        supplierId: r.primarySupplierId,
      });
    }
    // Resolve failureMode per workOrderId so REQUIRES_PART edges are
    // produced on live writes (not just backfill). Limited to
    // forward-consumption movement types — `release`/`return` are
    // reversals and would flip-count the edge. Reviewer's fifth-pass
    // blocker: without this, the most important counting edge for
    // operational reasoning drifted immediately after bootstrap.
    const consumingPending = pending.filter(
      (p) => p.workOrderId && (p.movementType === "reserve" || p.movementType === "consume")
    );
    const woIds = Array.from(
      new Set(consumingPending.map((p) => p.workOrderId).filter((id): id is string => !!id))
    );
    const failureModeByWo = new Map<string, string>();
    if (woIds.length > 0) {
      const fhRows = await db
        .select({
          workOrderId: failureHistory.workOrderId,
          failureMode: failureHistory.failureMode,
        })
        .from(failureHistory)
        .where(
          and(eq(failureHistory.orgId, orgId), sql`${failureHistory.workOrderId} = ANY(${woIds})`)
        );
      for (const r of fhRows as Array<{ workOrderId: string | null; failureMode: string | null }>) {
        if (r.workOrderId && r.failureMode) {
          failureModeByWo.set(r.workOrderId, r.failureMode);
        }
      }
    }
    await Promise.all(
      pending.map((p) => {
        const meta = partMeta.get(p.partId) ?? {};
        const isConsuming = p.movementType === "reserve" || p.movementType === "consume";
        const failureMode =
          isConsuming && p.workOrderId ? (failureModeByWo.get(p.workOrderId) ?? null) : null;
        return projectInventoryMovement(orgId, {
          movementId: p.movementId,
          partId: p.partId,
          workOrderId: p.workOrderId,
          partName: meta.name ?? null,
          supplierId: meta.supplierId ?? null,
          failureMode,
        }).catch((err) => {
          logger.warn(`[Graph] projectInventoryMovement(${p.movementId}) failed`, {
            orgId,
            partId: p.partId,
            details: err instanceof Error ? err.message : String(err),
          });
        });
      })
    );
  } catch (err) {
    // best-effort by contract; never fail the caller for graph errors,
    // but emit a structured warning so projector drift is observable.
    logger.warn(`[Graph] fireProjectionsAfterCommit failed`, {
      orgId,
      pendingCount: pending.length,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export * from "./types.js";
export { DbPartsStorage } from "./db-parts.js";
export { DbStockStorage } from "./db-stock.js";

// StockFilters used by DbStockStorage.getStock
interface StockFilters {
  search?: string | undefined;
  location?: string | undefined;
}

async function allocateReservation(
  tx: DbTransaction,
  partId: string,
  orgId: string,
  quantity: number
): Promise<{
  rows: { stockId: string; reserved: number; onHand: number; prevReserved: number }[];
}> {
  const allStock = await tx
    .select()
    .from(stock)
    .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)))
    .orderBy(sql`(${stock.quantityOnHand} - ${stock.quantityReserved}) DESC`);
  if (allStock.length === 0) {
    throw new Error(`Part ${partId} not found in stock`);
  }
  const totalAvailable = allStock.reduce(
    (s: number, r: Stock) => s + Math.max(0, (r.quantityOnHand ?? 0) - (r.quantityReserved ?? 0)),
    0
  );
  if (totalAvailable < quantity) {
    throw new Error(
      `Insufficient stock for part ${partId}: available=${totalAvailable}, requested=${quantity}`
    );
  }
  const allocated: { stockId: string; reserved: number; onHand: number; prevReserved: number }[] =
    [];
  let remaining = quantity;
  for (const row of allStock) {
    if (remaining <= 0) {
      break;
    }
    const avail = Math.max(0, (row.quantityOnHand ?? 0) - (row.quantityReserved ?? 0));
    const toReserve = Math.min(remaining, avail);
    if (toReserve > 0) {
      await tx
        .update(stock)
        .set({
          quantityReserved: (row.quantityReserved ?? 0) + toReserve,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, row.id));
      allocated.push({
        stockId: row.id,
        reserved: toReserve,
        onHand: row.quantityOnHand ?? 0,
        prevReserved: row.quantityReserved ?? 0,
      });
      remaining -= toReserve;
    }
  }
  return { rows: allocated };
}

async function distributeRelease(
  tx: DbTransaction,
  partId: string,
  orgId: string,
  quantity: number
): Promise<{
  rows: { stockId: string; released: number; onHand: number; prevReserved: number }[];
}> {
  const allStock = await tx
    .select()
    .from(stock)
    .where(
      and(eq(stock.partId, partId), eq(stock.orgId, orgId), sql`${stock.quantityReserved} > 0`)
    )
    .orderBy(sql`${stock.quantityReserved} DESC`);
  const released: { stockId: string; released: number; onHand: number; prevReserved: number }[] =
    [];
  let remaining = quantity;
  for (const row of allStock) {
    if (remaining <= 0) {
      break;
    }
    const reserved = row.quantityReserved ?? 0;
    const toRelease = Math.min(remaining, reserved);
    if (toRelease > 0) {
      await tx
        .update(stock)
        .set({ quantityReserved: reserved - toRelease, updatedAt: new Date() })
        .where(eq(stock.id, row.id));
      released.push({
        stockId: row.id,
        released: toRelease,
        onHand: row.quantityOnHand ?? 0,
        prevReserved: reserved,
      });
      remaining -= toRelease;
    }
  }
  return { rows: released };
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
    return this.partAndStockAsPartsInventory(orgId, { category, search, sortBy, sortOrder });
  }

  private async partAndStockAsPartsInventory(
    orgId?: string,
    opts?: {
      category?: string | undefined;
      search?: string | undefined;
      sortBy?: string | undefined;
      sortOrder?: "asc" | "desc" | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    }
  ): Promise<PartsInventory[]> {
    const conditions: SQL<unknown>[] = [];
    if (orgId) {
      conditions.push(eq(partsTable.orgId, orgId));
    }
    if (opts?.category) {
      conditions.push(eq(partsTable.category, opts.category));
    }
    if (opts?.search) {
      const searchCond = or(
        ilike(partsTable.name, `%${opts.search}%`),
        ilike(partsTable.partNo, `%${opts.search}%`)
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }
    const orderCol =
      opts?.sortBy === "partName"
        ? partsTable.name
        : opts?.sortBy === "category"
          ? partsTable.category
          : partsTable.name;
    const orderFn = opts?.sortOrder === "desc" ? desc(orderCol) : asc(orderCol);

    let partsQuery = db.select().from(partsTable);
    if (conditions.length > 0) {
      partsQuery = partsQuery.where(and(...conditions)) as typeof partsQuery;
    }
    let orderedParts = partsQuery.orderBy(orderFn);
    if (opts?.limit) {
      orderedParts = orderedParts.limit(opts.limit) as typeof orderedParts;
    }
    if (opts?.offset) {
      orderedParts = orderedParts.offset(opts.offset) as typeof orderedParts;
    }
    const partRows = await orderedParts;

    if (partRows.length === 0) {
      return [];
    }

    const partIds = partRows.map((p: Part) => p.id);
    const partIdsArray = sql`ARRAY[${sql.join(
      partIds.map((id: string) => sql`${id}`),
      sql`, `
    )}]::text[]`;
    const stockRows = await db
      .select()
      .from(stock)
      .where(sql`${stock.partId} = ANY(${partIdsArray})`);
    const stockMap = new Map<string, Stock[]>();
    for (const s of stockRows) {
      const arr = stockMap.get(s.partId) || [];
      arr.push(s);
      stockMap.set(s.partId, arr);
    }

    return partRows.map((p: Part) => partAndStockToPartsInventory(p, stockMap.get(p.id) || []));
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
      const allItems = await this.partAndStockAsPartsInventory(orgId, {
        category,
        search,
        sortBy,
        sortOrder,
      });
      const filtered = allItems.filter(stockStatusFilter);
      return { items: filtered.slice(offset, offset + limit), total: filtered.length };
    }

    const items = await this.partAndStockAsPartsInventory(orgId, {
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
    const all = await this.partAndStockAsPartsInventory(orgId);
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
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const result = {
      added: [] as WorkOrderParts[],
      updated: [] as WorkOrderParts[],
      errors: [] as string[],
    };
    // No graph projections here — addBulkPartsToWorkOrder only writes
    // to `work_order_parts`, not `inventory_movements`. REQUIRES_PART
    // edges are produced by the reserve / release / return paths via
    // fireProjectionsAfterCommit().

    await db.transaction(async (tx) => {
      const existingParts = await tx
        .select()
        .from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
      const existingMap = new Map<string, WorkOrderParts>(
        existingParts.map((p: WorkOrderParts) => [p.partId, p] as [string, WorkOrderParts])
      );

      for (const partToAdd of partsToAdd) {
        try {
          const [stockRow] = await tx
            .select()
            .from(stock)
            .where(and(eq(stock.partId, partToAdd.partId), eq(stock.orgId, orgId)))
            .limit(1);
          const unitCost = stockRow?.unitCost || 0;
          const existing = existingMap.get(partToAdd.partId);

          if (existing) {
            const newQty = (existing.quantityUsed ?? 0) + partToAdd.quantity;
            const [updated] = await tx
              .update(workOrderParts)
              .set({
                quantityUsed: newQty,
                totalCost: newQty * unitCost,
                notes: partToAdd.notes
                  ? existing.notes
                    ? `${existing.notes}; ${partToAdd.notes}`
                    : partToAdd.notes
                  : existing.notes,
                updatedAt: new Date(),
              } as never)
              .where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId)))
              .returning();
            if (!updated) {
              throw new Error("addBulkParts: update returned no row");
            }
            result.updated.push(updated);
            existingMap.set(partToAdd.partId, updated);
          } else {
            const [newPart] = await tx
              .insert(workOrderParts)
              .values({
                id: randomUUID(),
                orgId,
                workOrderId,
                partId: partToAdd.partId,
                quantityUsed: partToAdd.quantity,
                unitCost,
                totalCost: partToAdd.quantity * unitCost,
                usedBy: partToAdd.usedBy,
                notes: partToAdd.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as never)
              .returning();
            if (!newPart) {
              throw new Error("addBulkParts: insert returned no row");
            }
            result.added.push(newPart);
            existingMap.set(partToAdd.partId, newPart);
          }
        } catch (err) {
          result.errors.push(
            `Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    });

    return result;
  }

  async reservePartsForWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }

    const pendingProjections: PendingMovementProjection[] = [];
    await db.transaction(async (tx) => {
      const woParts = await tx
        .select()
        .from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

      const partQuantities = new Map<string, number>();
      for (const woPart of woParts) {
        partQuantities.set(
          woPart.partId,
          (partQuantities.get(woPart.partId) || 0) + (woPart.quantityUsed ?? 0)
        );
      }

      // Use Array.from to avoid downlevelIteration target requirement
      for (const [partId, totalQty] of Array.from(partQuantities.entries())) {
        const { rows } = await allocateReservation(tx, partId, orgId, totalQty);
        for (const alloc of rows) {
          const movementId = randomUUID();
          await tx.insert(inventoryMovements).values({
            id: movementId,
            orgId,
            partId,
            workOrderId,
            movementType: "reserve",
            quantity: alloc.reserved,
            quantityBefore: alloc.onHand,
            quantityAfter: alloc.onHand,
            reservedBefore: alloc.prevReserved,
            reservedAfter: alloc.prevReserved + alloc.reserved,
            performedBy: "system",
            notes: `Reserved ${alloc.reserved} units for work order ${workOrderId} (stock ${alloc.stockId})`,
            createdAt: new Date(),
          });
          pendingProjections.push({ movementId, partId, workOrderId, movementType: "reserve" });
        }
      }
    });
    await fireProjectionsAfterCommit(orgId, pendingProjections);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
    orgId: string
  ): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const result = {
      added: [] as WorkOrderParts[],
      updated: [] as WorkOrderParts[],
      errors: [] as string[],
    };
    const pendingProjections: PendingMovementProjection[] = [];

    await db.transaction(async (tx) => {
      const existingParts = await tx
        .select()
        .from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
      const existingMap = new Map<string, WorkOrderParts>(
        existingParts.map((p: WorkOrderParts) => [p.partId, p] as [string, WorkOrderParts])
      );

      for (const partToAdd of partsToAdd) {
        try {
          const [stockRow] = await tx
            .select()
            .from(stock)
            .where(and(eq(stock.partId, partToAdd.partId), eq(stock.orgId, orgId)))
            .limit(1);
          const unitCost = stockRow?.unitCost || 0;
          const existing = existingMap.get(partToAdd.partId);

          if (existing) {
            const newQty = (existing.quantityUsed ?? 0) + partToAdd.quantity;
            const [updated] = await tx
              .update(workOrderParts)
              .set({
                quantityUsed: newQty,
                totalCost: newQty * unitCost,
                notes: partToAdd.notes
                  ? existing.notes
                    ? `${existing.notes}; ${partToAdd.notes}`
                    : partToAdd.notes
                  : existing.notes,
                updatedAt: new Date(),
              } as never)
              .where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId)))
              .returning();
            if (!updated) {
              throw new Error("addBulkPartsAndReserveInventory: update returned no row");
            }
            result.updated.push(updated);
            existingMap.set(partToAdd.partId, updated);
          } else {
            const [newPart] = await tx
              .insert(workOrderParts)
              .values({
                id: randomUUID(),
                orgId,
                workOrderId,
                partId: partToAdd.partId,
                quantityUsed: partToAdd.quantity,
                unitCost,
                totalCost: partToAdd.quantity * unitCost,
                usedBy: partToAdd.usedBy,
                notes: partToAdd.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as never)
              .returning();
            if (!newPart) {
              throw new Error("addBulkPartsAndReserveInventory: insert returned no row");
            }
            result.added.push(newPart);
            existingMap.set(partToAdd.partId, newPart);
          }
        } catch (err) {
          result.errors.push(
            `Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (result.added.length > 0 || result.updated.length > 0) {
        const allWoParts = await tx
          .select()
          .from(workOrderParts)
          .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

        const partQuantities = new Map<string, number>();
        for (const woPart of allWoParts) {
          partQuantities.set(
            woPart.partId,
            (partQuantities.get(woPart.partId) || 0) + (woPart.quantityUsed ?? 0)
          );
        }

        for (const [partId, totalQty] of Array.from(partQuantities.entries())) {
          const { rows } = await allocateReservation(tx, partId, orgId, totalQty);
          for (const alloc of rows) {
            const movementId = randomUUID();
            await tx.insert(inventoryMovements).values({
              id: movementId,
              orgId,
              partId,
              workOrderId,
              movementType: "reserve",
              quantity: alloc.reserved,
              quantityBefore: alloc.onHand,
              quantityAfter: alloc.onHand,
              reservedBefore: alloc.prevReserved,
              reservedAfter: alloc.prevReserved + alloc.reserved,
              performedBy: "system",
              notes: `Reserved for work order ${workOrderId} (stock ${alloc.stockId})`,
              createdAt: new Date(),
            });
            pendingProjections.push({ movementId, partId, workOrderId, movementType: "reserve" });
          }
        }
      }
    });
    await fireProjectionsAfterCommit(orgId, pendingProjections);

    return result;
  }

  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }

    const pendingProjections: PendingMovementProjection[] = [];
    await db.transaction(async (tx) => {
      const woParts = await tx
        .select()
        .from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

      const partQuantities = new Map<string, number>();
      for (const woPart of woParts) {
        partQuantities.set(
          woPart.partId,
          (partQuantities.get(woPart.partId) || 0) + (woPart.quantityUsed ?? 0)
        );
      }

      for (const [partId, totalQty] of Array.from(partQuantities.entries())) {
        const { rows } = await distributeRelease(tx, partId, orgId, totalQty);
        for (const rel of rows) {
          const movementId = randomUUID();
          await tx.insert(inventoryMovements).values({
            id: movementId,
            orgId,
            partId,
            workOrderId,
            movementType: "release",
            quantity: rel.released,
            quantityBefore: rel.onHand,
            quantityAfter: rel.onHand,
            reservedBefore: rel.prevReserved,
            reservedAfter: rel.prevReserved - rel.released,
            performedBy: "system",
            notes: `Released from work order ${workOrderId} (stock ${rel.stockId})`,
            createdAt: new Date(),
          });
          pendingProjections.push({ movementId, partId, workOrderId, movementType: "release" });
        }
      }
    });
    await fireProjectionsAfterCommit(orgId, pendingProjections);
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
    if (!orgId) {
      throw new Error("orgId is required for tenant isolation");
    }
    const pendingProjections: PendingMovementProjection[] = [];
    await db.transaction(async (tx) => {
      const [woPart] = await tx
        .select()
        .from(workOrderParts)
        .where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));
      if (!woPart) {
        throw new Error(`Work order part ${workOrderPartId} not found`);
      }

      const { rows } = await distributeRelease(tx, woPart.partId, orgId, woPart.quantityUsed ?? 0);
      for (const rel of rows) {
        const movementId = randomUUID();
        await tx.insert(inventoryMovements).values({
          id: movementId,
          orgId,
          partId: woPart.partId,
          workOrderId: woPart.workOrderId,
          movementType: "return",
          quantity: rel.released,
          quantityBefore: rel.onHand,
          quantityAfter: rel.onHand,
          reservedBefore: rel.prevReserved,
          reservedAfter: rel.prevReserved - rel.released,
          performedBy,
          notes: `Returned ${rel.released} units from work order (stock ${rel.stockId})`,
          createdAt: new Date(),
        });
        pendingProjections.push({
          movementId,
          partId: woPart.partId,
          workOrderId: woPart.workOrderId,
          movementType: "return",
        });
      }

      await tx
        .delete(workOrderParts)
        .where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));

      // Defer projection until after the surrounding tx commits below
      // (see fireProjectionsAfterCommit at end of method).

      const [wo] = await tx
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
      if (wo) {
        const remainingParts = await tx
          .select()
          .from(workOrderParts)
          .where(
            and(eq(workOrderParts.workOrderId, woPart.workOrderId), eq(workOrderParts.orgId, orgId))
          );
        const totalPartsCost = remainingParts.reduce(
          (sum: number, p: WorkOrderParts) => sum + (p.totalCost || 0),
          0
        );
        await tx
          .update(workOrders)
          .set({
            totalPartsCost,
            totalCost: totalPartsCost + (wo.totalLaborCost || 0),
            updatedAt: new Date(),
          })
          .where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
      }
    });
    await fireProjectionsAfterCommit(orgId, pendingProjections);
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
