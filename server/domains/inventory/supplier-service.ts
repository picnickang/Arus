import type { PartsInventorySupplier, InsertPartsInventorySupplier } from "@shared/schema";
import { inventorySupplierRepository, type SupplierLinkWithDetails } from "./supplier-repository";
import { recordAndPublish } from "../../sync-events";

/**
 * Service for managing inventory item supplier links
 * Handles business logic for the multi-supplier support feature
 */
export class InventorySupplierService {
  /**
   * Get all suppliers linked to an inventory item with details
   */
  async getSupplierLinks(inventoryItemId: string): Promise<SupplierLinkWithDetails[]> {
    return inventorySupplierRepository.findByInventoryItemId(inventoryItemId);
  }

  /**
   * Get all inventory items linked to a supplier
   */
  async getInventoryItemsForSupplier(supplierId: string): Promise<PartsInventorySupplier[]> {
    return inventorySupplierRepository.findBySupplierId(supplierId);
  }

  /**
   * Link a supplier to an inventory item
   */
  async linkSupplier(
    data: InsertPartsInventorySupplier,
    userId?: string
  ): Promise<PartsInventorySupplier> {
    const exists = await inventorySupplierRepository.exists(data.inventoryItemId, data.supplierId);
    if (exists) {
      throw new Error("Supplier is already linked to this inventory item");
    }

    const link = await inventorySupplierRepository.create(data);

    await recordAndPublish(
      "inventory_supplier_link",
      link.id,
      "create",
      { inventoryItemId: data.inventoryItemId, supplierId: data.supplierId },
      userId
    );

    return link;
  }

  /**
   * Bulk link suppliers to an inventory item
   */
  async bulkLinkSuppliers(
    inventoryItemId: string,
    supplierIds: string[],
    userId?: string
  ): Promise<PartsInventorySupplier[]> {
    const links: InsertPartsInventorySupplier[] = supplierIds.map((supplierId) => ({
      inventoryItemId,
      supplierId,
    }));

    const results = await inventorySupplierRepository.createMany(links);

    if (results.length > 0) {
      await recordAndPublish(
        "inventory_supplier_link",
        inventoryItemId,
        "bulk_create",
        { inventoryItemId, supplierIds },
        userId
      );
    }

    return results;
  }

  /**
   * Update a supplier link (cost, lead time, notes, etc.)
   */
  async updateSupplierLink(
    linkId: string,
    data: Partial<Omit<InsertPartsInventorySupplier, "inventoryItemId" | "supplierId">>,
    userId?: string
  ): Promise<PartsInventorySupplier | undefined> {
    const result = await inventorySupplierRepository.update(linkId, data);

    if (result) {
      await recordAndPublish("inventory_supplier_link", linkId, "update", data, userId);
    }

    return result;
  }

  /**
   * Unlink a supplier from an inventory item
   */
  async unlinkSupplier(linkId: string, userId?: string): Promise<boolean> {
    const deleted = await inventorySupplierRepository.delete(linkId);

    if (deleted) {
      await recordAndPublish("inventory_supplier_link", linkId, "delete", {}, userId);
    }

    return deleted;
  }

  /**
   * Replace all supplier links for an inventory item
   */
  async replaceSupplierLinks(
    inventoryItemId: string,
    supplierIds: string[],
    userId?: string
  ): Promise<PartsInventorySupplier[]> {
    await inventorySupplierRepository.deleteByInventoryItemId(inventoryItemId);

    if (supplierIds.length === 0) {
      return [];
    }

    const links = await this.bulkLinkSuppliers(inventoryItemId, supplierIds, userId);

    await recordAndPublish(
      "inventory_supplier_link",
      inventoryItemId,
      "replace",
      { inventoryItemId, supplierIds },
      userId
    );

    return links;
  }

  /**
   * Set a supplier as the preferred supplier for an inventory item
   */
  async setPreferredSupplier(
    inventoryItemId: string,
    supplierId: string,
    userId?: string
  ): Promise<void> {
    const exists = await inventorySupplierRepository.exists(inventoryItemId, supplierId);
    if (!exists) {
      throw new Error("Supplier is not linked to this inventory item");
    }

    await inventorySupplierRepository.setPreferred(inventoryItemId, supplierId);

    await recordAndPublish(
      "inventory_supplier_link",
      inventoryItemId,
      "set_preferred",
      { inventoryItemId, supplierId },
      userId
    );
  }

  /**
   * Hydrate inventory items with their linked suppliers
   * Useful for API responses that need to include supplier data inline
   */
  async hydrateWithSuppliers<T extends { id: string }>(
    items: T[]
  ): Promise<Array<T & { linkedSuppliers: SupplierLinkWithDetails[] }>> {
    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((item) => item.id);
    const allLinks = await inventorySupplierRepository.findByInventoryItemIds(itemIds);

    const linksByItemId = new Map<string, SupplierLinkWithDetails[]>();
    for (const link of allLinks) {
      const existing = linksByItemId.get(link.inventoryItemId) || [];
      existing.push(link);
      linksByItemId.set(link.inventoryItemId, existing);
    }

    return items.map((item) => ({
      ...item,
      linkedSuppliers: linksByItemId.get(item.id) || [],
    }));
  }

  /**
   * Hydrate a single inventory item with its linked suppliers
   */
  async hydrateItemWithSuppliers<T extends { id: string }>(
    item: T
  ): Promise<T & { linkedSuppliers: SupplierLinkWithDetails[] }> {
    const linkedSuppliers = await this.getSupplierLinks(item.id);
    return { ...item, linkedSuppliers };
  }
}

export const inventorySupplierService = new InventorySupplierService();
