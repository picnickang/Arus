/**
 * Inventory - Database Storage Stock, Suppliers & Substitutions
 */

import { randomUUID } from "node:crypto";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { db } from "../../db-config";
import { suppliers, stock, partSubstitutions, parts, partsInventorySuppliers } from "@shared/schema-runtime";
import type { Supplier, InsertSupplier, Stock, InsertStock, PartSubstitution, InsertPartSubstitution, Part } from "@shared/schema";
import type { StockFilters } from "./types.js";

export class DbStockStorage {
  private validateOrgId(orgId: string | undefined, method: string): void {
    if (!orgId) { throw new Error(`[${method}] orgId is required`); }
  }

  async getPartStockWithSupplierLeadTime(
    partId: string,
    orgId: string
  ): Promise<{
    partId: string;
    partName: string;
    partNumber: string;
    quantityOnHand: number;
    quantityReserved: number;
    availableQuantity: number;
    isOutOfStock: boolean;
    preferredSupplier?: { id: string; name: string; leadTimeDays: number | null };
    estimatedLeadTimeDays: number;
  } | null> {
    this.validateOrgId(orgId, "getPartStockWithSupplierLeadTime");

    const [partRow] = await db
      .select()
      .from(parts)
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)))
      .limit(1);

    if (!partRow) { return null; }

    const stockRows = await db
      .select()
      .from(stock)
      .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)));

    const quantityOnHand = stockRows.reduce((s, r) => s + Math.round(r.quantityOnHand ?? 0), 0);
    const quantityReserved = stockRows.reduce((s, r) => s + Math.round(r.quantityReserved ?? 0), 0);
    const availableQuantity = Math.max(0, quantityOnHand - quantityReserved);

    let preferredSupplier: { id: string; name: string; leadTimeDays: number | null } | undefined;
    let estimatedLeadTimeDays = 14;

    let linkedSuppliers = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        leadTimeDays: suppliers.leadTimeDays,
        isPreferred: partsInventorySuppliers.isPreferred,
      })
      .from(partsInventorySuppliers)
      .innerJoin(suppliers, eq(partsInventorySuppliers.supplierId, suppliers.id))
      .where(
        and(
          eq(partsInventorySuppliers.inventoryItemId, partId),
          eq(suppliers.orgId, orgId),
          eq(suppliers.isActive, true)
        )
      )
      .orderBy(
        sql`${partsInventorySuppliers.isPreferred} DESC`,
        sql`${suppliers.leadTimeDays} ASC NULLS LAST`
      )
      .limit(5);

    if (linkedSuppliers.length === 0 && partRow.partNo) {
      linkedSuppliers = await db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          leadTimeDays: suppliers.leadTimeDays,
          isPreferred: partsInventorySuppliers.isPreferred,
        })
        .from(partsInventorySuppliers)
        .innerJoin(suppliers, eq(partsInventorySuppliers.supplierId, suppliers.id))
        .innerJoin(
          sql`parts_inventory pi`,
          sql`pi.id = ${partsInventorySuppliers.inventoryItemId}`
        )
        .where(
          and(
            sql`pi.part_number = ${partRow.partNo}`,
            sql`pi.org_id = ${orgId}`,
            eq(suppliers.orgId, orgId),
            eq(suppliers.isActive, true)
          )
        )
        .orderBy(
          sql`${partsInventorySuppliers.isPreferred} DESC`,
          sql`${suppliers.leadTimeDays} ASC NULLS LAST`
        )
        .limit(5);
    }

    if (linkedSuppliers.length > 0) {
      const chosen = linkedSuppliers.find((s) => s.isPreferred) ?? linkedSuppliers[0];
      preferredSupplier = {
        id: chosen.id,
        name: chosen.name,
        leadTimeDays: chosen.leadTimeDays,
      };
      estimatedLeadTimeDays = chosen.leadTimeDays ?? 14;
    }

    return {
      partId: partRow.id,
      partName: partRow.name,
      partNumber: partRow.partNo,
      quantityOnHand,
      quantityReserved,
      availableQuantity,
      isOutOfStock: availableQuantity === 0,
      preferredSupplier,
      estimatedLeadTimeDays,
    };
  }

  async getSuppliers(orgId?: string): Promise<Supplier[]> {
    if (orgId) { return db.select().from(suppliers).where(eq(suppliers.orgId, orgId)).orderBy(suppliers.name); }
    return db.select().from(suppliers).orderBy(suppliers.name);
  }

  async getSupplier(id: string, orgId?: string): Promise<Supplier | undefined> {
    const conditions = orgId ? and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)) : eq(suppliers.id, id);
    const [result] = await db.select().from(suppliers).where(conditions);
    return result;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [n] = await db.insert(suppliers).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return n;
  }

  async updateSupplier(id: string, updates: Partial<InsertSupplier>, orgId?: string): Promise<Supplier> {
    this.validateOrgId(orgId, "updateSupplier");
    const conditions = orgId ? and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)) : eq(suppliers.id, id);
    const [updated] = await db.update(suppliers).set({ ...updates, updatedAt: new Date() }).where(conditions).returning();
    if (!updated) { throw new Error(`Supplier ${id} not found`); }
    return updated;
  }

  async deleteSupplier(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteSupplier");
    const conditions = orgId ? and(eq(suppliers.id, id), eq(suppliers.orgId, orgId)) : eq(suppliers.id, id);
    await db.delete(suppliers).where(conditions);
  }

  async getStock(orgId?: string, filters?: StockFilters): Promise<Stock[]> {
    const conditions: any[] = [];
    if (orgId) { conditions.push(eq(stock.orgId, orgId)); }
    if (filters?.partId) { conditions.push(eq(stock.partId, filters.partId)); }
    if (filters?.vesselId) { conditions.push(eq(stock.vesselId, filters.vesselId)); }
    if (filters?.location) { conditions.push(eq(stock.location, filters.location)); }
    if (conditions.length > 0) { return db.select().from(stock).where(and(...conditions)); }
    return db.select().from(stock);
  }

  async createStock(data: InsertStock): Promise<Stock> {
    const [n] = await db.insert(stock).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return n;
  }

  async updateStock(id: string, updates: Partial<InsertStock>, orgId?: string): Promise<Stock> {
    this.validateOrgId(orgId, "updateStock");
    const conditions = orgId ? and(eq(stock.id, id), eq(stock.orgId, orgId)) : eq(stock.id, id);
    const [updated] = await db.update(stock).set({ ...updates, updatedAt: new Date() }).where(conditions).returning();
    if (!updated) { throw new Error(`Stock ${id} not found`); }
    return updated;
  }

  async deleteStock(id: string, orgId?: string): Promise<void> {
    this.validateOrgId(orgId, "deleteStock");
    const conditions = orgId ? and(eq(stock.id, id), eq(stock.orgId, orgId)) : eq(stock.id, id);
    await db.delete(stock).where(conditions);
  }

  async getPartSubstitutions(partId: string, orgId: string): Promise<PartSubstitution[]> {
    this.validateOrgId(orgId, "getPartSubstitutions");
    return db.select().from(partSubstitutions).where(and(eq(partSubstitutions.orgId, orgId), or(eq(partSubstitutions.originalPartId, partId), eq(partSubstitutions.substitutePartId, partId))));
  }

  async createPartSubstitution(sub: InsertPartSubstitution): Promise<PartSubstitution> {
    const [n] = await db.insert(partSubstitutions).values({ id: randomUUID(), ...sub, createdAt: new Date(), updatedAt: new Date() }).returning();
    return n;
  }

  async suggestPartSubstitutions(partId: string, orgId: string): Promise<Part[]> {
    const subs = await this.getPartSubstitutions(partId, orgId);
    if (subs.length === 0) { return []; }
    const ids = subs.map((s) => s.originalPartId === partId ? s.substitutePartId : s.originalPartId);
    return db.select().from(parts).where(and(inArray(parts.id, ids), eq(parts.orgId, orgId)));
  }

  async getPartByPartNo(partNo: string, orgId?: string): Promise<Part | undefined> {
    const conditions = [eq(parts.partNo, partNo)];
    if (orgId) { conditions.push(eq(parts.orgId, orgId)); }
    const [result] = await db.select().from(parts).where(and(...conditions)).limit(1);
    return result;
  }

  async getPartsByNumbers(partNumbers: string[], orgId: string): Promise<Part[]> {
    if (partNumbers.length === 0) { return []; }
    return db.select().from(parts).where(and(inArray(parts.partNo, partNumbers), eq(parts.orgId, orgId)));
  }

  async deletePartCatalog(id: string): Promise<void> {
    await db.delete(parts).where(eq(parts.id, id));
  }

  async syncPartCostToStock(partId: string): Promise<void> {
    const [part] = await db
      .select({ id: parts.id, partNo: parts.partNo, standardCost: parts.standardCost, orgId: parts.orgId })
      .from(parts)
      .where(eq(parts.id, partId))
      .limit(1);
    if (!part) { throw new Error(`Part ${partId} not found`); }
    await db.update(stock).set({ unitCost: part.standardCost, updatedAt: new Date() }).where(and(eq(stock.partNo, part.partNo), eq(stock.orgId, part.orgId)));
  }

  async getStockByPart(partId: string, orgId?: string): Promise<Stock[]> {
    const conditions = [eq(stock.partId, partId)];
    if (orgId) { conditions.push(eq(stock.orgId, orgId)); }
    return db.select().from(stock).where(and(...conditions));
  }

  async getStockByParts(partIds: string[], orgId: string): Promise<Stock[]> {
    if (partIds.length === 0) { return []; }
    return db.select().from(stock).where(and(inArray(stock.partId, partIds), eq(stock.orgId, orgId)));
  }

  async getPartSubstitutionsByPartNo(partNo: string, orgId?: string): Promise<PartSubstitution[]> {
    const conditions = [eq(partSubstitutions.primaryPartNo, partNo)];
    if (orgId) { conditions.push(eq(partSubstitutions.orgId, orgId)); }
    return db.select().from(partSubstitutions).where(and(...conditions));
  }

  async deletePartSubstitution(id: string): Promise<void> {
    await db.delete(partSubstitutions).where(eq(partSubstitutions.id, id));
  }

  async seedStockForParts(orgId?: string): Promise<{ created: number; skipped: number }> {
    const targetOrgId = orgId || "default-org-id";
    const result = await db.execute(sql`
      SELECT p.id, p.part_no, p.org_id, p.standard_cost
      FROM parts p
      LEFT JOIN stock s ON p.id = s.part_id AND s.location = 'MAIN' AND s.org_id = p.org_id
      WHERE p.org_id = ${targetOrgId} AND s.id IS NULL
    `);
    let created = 0;
    let skipped = 0;
    for (const part of result.rows) {
      try {
        await db.insert(stock).values({
          orgId: (part as any).org_id,
          partId: (part as any).id,
          partNo: (part as any).part_no,
          location: "MAIN",
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityOnOrder: 0,
          unitCost: (part as any).standard_cost || 0,
        });
        created++;
      } catch {
        skipped++;
      }
    }
    return { created, skipped };
  }
}
