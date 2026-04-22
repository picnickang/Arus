import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  partsInventorySuppliers,
  suppliers,
  type PartsInventorySupplier,
  type InsertPartsInventorySupplier,
  type Supplier,
} from "@shared/schema-runtime";

export interface SupplierLinkWithDetails extends PartsInventorySupplier {
  supplier?: Supplier;
}

/**
 * Repository for parts inventory supplier links
 * Handles CRUD operations for the junction table connecting inventory items to suppliers
 */
export class InventorySupplierRepository {
  /**
   * Find all supplier links for an inventory item
   */
  async findByInventoryItemId(inventoryItemId: string): Promise<SupplierLinkWithDetails[]> {
    const links = await db
      .select({
        link: partsInventorySuppliers,
        supplier: suppliers,
      })
      .from(partsInventorySuppliers)
      .leftJoin(suppliers, eq(partsInventorySuppliers.supplierId, suppliers.id))
      .where(eq(partsInventorySuppliers.inventoryItemId, inventoryItemId));

    return links.map(({ link, supplier }) => ({
      ...link,
      supplier: supplier || undefined,
    }));
  }

  /**
   * Find all inventory items linked to a supplier
   */
  async findBySupplierId(supplierId: string): Promise<PartsInventorySupplier[]> {
    return db
      .select()
      .from(partsInventorySuppliers)
      .where(eq(partsInventorySuppliers.supplierId, supplierId));
  }

  /**
   * Find supplier links for multiple inventory items (bulk hydration)
   */
  async findByInventoryItemIds(inventoryItemIds: string[]): Promise<SupplierLinkWithDetails[]> {
    if (inventoryItemIds.length === 0) {return [];}

    const links = await db
      .select({
        link: partsInventorySuppliers,
        supplier: suppliers,
      })
      .from(partsInventorySuppliers)
      .leftJoin(suppliers, eq(partsInventorySuppliers.supplierId, suppliers.id))
      .where(inArray(partsInventorySuppliers.inventoryItemId, inventoryItemIds));

    return links.map(({ link, supplier }) => ({
      ...link,
      supplier: supplier || undefined,
    }));
  }

  /**
   * Create a new supplier link
   */
  async create(data: InsertPartsInventorySupplier): Promise<PartsInventorySupplier> {
    const [result] = await db
      .insert(partsInventorySuppliers)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Bulk create supplier links for an inventory item
   */
  async createMany(links: InsertPartsInventorySupplier[]): Promise<PartsInventorySupplier[]> {
    if (links.length === 0) {return [];}
    return await db
      .insert(partsInventorySuppliers)
      .values(links)
      .onConflictDoNothing()
      .returning();
  }

  /**
   * Update a supplier link
   */
  async update(
    id: string,
    data: Partial<Omit<InsertPartsInventorySupplier, "inventoryItemId" | "supplierId">>
  ): Promise<PartsInventorySupplier | undefined> {
    const [result] = await db
      .update(partsInventorySuppliers)
      .set(data)
      .where(eq(partsInventorySuppliers.id, id))
      .returning();
    return result;
  }

  /**
   * Delete a supplier link by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(partsInventorySuppliers)
      .where(eq(partsInventorySuppliers.id, id))
      .returning({ id: partsInventorySuppliers.id });
    return result.length > 0;
  }

  /**
   * Delete all supplier links for an inventory item
   */
  async deleteByInventoryItemId(inventoryItemId: string): Promise<number> {
    const result = await db
      .delete(partsInventorySuppliers)
      .where(eq(partsInventorySuppliers.inventoryItemId, inventoryItemId))
      .returning({ id: partsInventorySuppliers.id });
    return result.length;
  }

  /**
   * Set preferred supplier for an inventory item (clears other preferred flags)
   */
  async setPreferred(inventoryItemId: string, supplierId: string): Promise<void> {
    await db
      .update(partsInventorySuppliers)
      .set({ isPreferred: false })
      .where(eq(partsInventorySuppliers.inventoryItemId, inventoryItemId));

    await db
      .update(partsInventorySuppliers)
      .set({ isPreferred: true })
      .where(
        and(
          eq(partsInventorySuppliers.inventoryItemId, inventoryItemId),
          eq(partsInventorySuppliers.supplierId, supplierId)
        )
      );
  }

  /**
   * Check if a supplier link exists
   */
  async exists(inventoryItemId: string, supplierId: string): Promise<boolean> {
    const [result] = await db
      .select({ id: partsInventorySuppliers.id })
      .from(partsInventorySuppliers)
      .where(
        and(
          eq(partsInventorySuppliers.inventoryItemId, inventoryItemId),
          eq(partsInventorySuppliers.supplierId, supplierId)
        )
      )
      .limit(1);
    return !!result;
  }
}

export const inventorySupplierRepository = new InventorySupplierRepository();
