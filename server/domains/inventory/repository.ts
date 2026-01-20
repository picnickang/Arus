import type {
  Part,
  PartsInventory,
  InsertPartsInventory,
  Equipment,
} from "@shared/schema-runtime";
import { storage } from "../../storage";

/**
 * Inventory (Parts) Repository
 * Handles all data access for parts and inventory domain
 */
export class InventoryRepository {
  // ========== Parts (Enhanced Inventory) Methods ==========

  /**
   * Find all parts (enhanced inventory catalog)
   */
  async findAllParts(orgId?: string): Promise<Part[]> {
    return storage.getPartsCatalogue(orgId);
  }

  /**
   * Find part by part number
   */
  async findPartByNumber(partNo: string, orgId?: string): Promise<Part | undefined> {
    return storage.getPartCatalogueByNumber(partNo, orgId);
  }

  /**
   * Delete part from catalog
   */
  async deletePart(id: string): Promise<void> {
    return storage.deletePartCatalogue(id);
  }

  /**
   * Sync part cost to stock
   */
  async syncCosts(partId: string): Promise<void> {
    return storage.syncPartCostToStock(partId);
  }

  // ========== Parts Inventory (CMMS-lite) Methods ==========

  /**
   * Find all parts inventory
   */
  async findPartsInventory(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<any[]> {
    return storage.getPartsInventory(category, orgId, search, sortBy, sortOrder);
  }

  /**
   * Find parts inventory item by ID
   */
  async findInventoryById(id: string, orgId?: string): Promise<PartsInventory | undefined> {
    return storage.getPartById(id, orgId);
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(data: InsertPartsInventory): Promise<PartsInventory> {
    return storage.createPart(data);
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(
    id: string,
    data: Partial<InsertPartsInventory>,
    orgId?: string
  ): Promise<PartsInventory> {
    return storage.updatePart(id, data, orgId || "default-org-id");
  }

  /**
   * Update part cost
   */
  async updatePartCost(
    partId: string,
    updateData: { unitCost: number; supplier: string }
  ): Promise<PartsInventory> {
    return storage.updatePartCost(partId, updateData);
  }

  /**
   * Update part stock quantities
   */
  async updatePartStock(
    partId: string,
    updateData: {
      quantityOnHand?: number;
      quantityReserved?: number;
      minStockLevel?: number;
      maxStockLevel?: number;
    }
  ): Promise<PartsInventory> {
    return storage.updatePartStockQuantities(partId, updateData);
  }

  // ========== Availability and Compatibility Methods ==========

  /**
   * Check part availability for work order
   */
  async checkAvailability(
    partId: string,
    quantity: number,
    orgId?: string
  ): Promise<{
    available: boolean;
    onHand: number;
    reserved: number;
  }> {
    return storage.checkPartAvailabilityForWorkOrder(partId, quantity, orgId);
  }

  /**
   * Find compatible equipment for a part
   */
  async findCompatibleEquipment(partId: string, orgId: string): Promise<Equipment[]> {
    return storage.getEquipmentForPart(partId, orgId);
  }

  /**
   * Update part compatibility with equipment
   */
  async updateCompatibility(partId: string, equipmentIds: string[], orgId: string): Promise<Part> {
    return storage.updatePartCompatibility(partId, equipmentIds, orgId);
  }

  /**
   * Find compatible parts for equipment
   */
  async findPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]> {
    return storage.getPartsForEquipment(equipmentId, orgId);
  }

  /**
   * Get low stock parts
   */
  async findLowStockParts(orgId?: string): Promise<PartsInventory[]> {
    return storage.getLowStockParts(orgId);
  }
}

// Export singleton instance
export const inventoryRepository = new InventoryRepository();
