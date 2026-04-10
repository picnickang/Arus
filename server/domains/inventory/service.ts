import type {
  Part,
  PartsInventory,
  InsertPartsInventory,
  Equipment,
} from "@shared/schema-runtime";
import { inventoryRepository } from "./repository";
import { recordAndPublish } from "../../sync-events";
import { dbInventoryStorage } from "../../repositories";

/**
 * Inventory (Parts) Service
 * Handles business logic, orchestration, and event publishing for inventory domain
 */
export class InventoryService {
  // ========== Parts (Enhanced Inventory) Methods ==========

  /**
   * List all parts from enhanced catalog
   */
  async listParts(orgId?: string): Promise<Part[]> {
    return inventoryRepository.findAllParts(orgId);
  }

  /**
   * Get part by part number
   */
  async getPartByNumber(partNo: string, orgId?: string): Promise<Part | undefined> {
    return inventoryRepository.findPartByNumber(partNo, orgId);
  }

  /**
   * Delete part from catalog
   */
  async deletePart(id: string, orgId: string, userId?: string): Promise<void> {
    // Get part data before deletion for event
    const part = await inventoryRepository.findPartByNumber(id, orgId);

    // Delete part
    await inventoryRepository.deletePart(id);

    // Publish delete event
    if (part) {
      await recordAndPublish("part", id, "delete", part, userId);
    }
  }

  /**
   * Sync part cost to stock
   */
  async syncPartCosts(partId: string, userId?: string): Promise<void> {
    await inventoryRepository.syncCosts(partId);

    // Publish sync event
    await recordAndPublish("part", partId, "update", { action: "cost_sync" }, userId);
  }

  // ========== Parts Inventory (CMMS-lite) Methods ==========

  /**
   * List parts inventory with filters
   */
  async listPartsInventory(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<any[]> {
    return inventoryRepository.findPartsInventory(category, orgId, search, sortBy, sortOrder);
  }

  /**
   * Get parts inventory item by ID
   */
  async getInventoryById(id: string, orgId?: string): Promise<PartsInventory | undefined> {
    return inventoryRepository.findInventoryById(id, orgId);
  }

  /**
   * Create new inventory item with event publishing
   */
  async createInventoryItem(data: InsertPartsInventory, userId?: string): Promise<PartsInventory> {
    // Create inventory item
    const item = await inventoryRepository.createInventoryItem(data);

    // Publish events (recordAndPublish handles both webhook and MQTT sync)
    await recordAndPublish("parts_inventory", item.id, "create", item, userId);

    return item;
  }

  /**
   * Update inventory item with event publishing
   */
  async updateInventoryItem(
    id: string,
    data: Partial<InsertPartsInventory>,
    userId?: string,
    orgId?: string
  ): Promise<PartsInventory> {
    // Update inventory item
    const item = await inventoryRepository.updateInventoryItem(id, data, orgId);

    // Publish events (recordAndPublish handles both webhook and MQTT sync)
    await recordAndPublish("parts_inventory", item.id, "update", item, userId);

    return item;
  }

  /**
   * Update part cost with event publishing
   */
  async updatePartCost(
    partId: string,
    updateData: { unitCost: number; supplier: string },
    userId?: string
  ): Promise<PartsInventory> {
    // Update cost
    const item = await inventoryRepository.updatePartCost(partId, updateData);

    // Publish events (recordAndPublish handles both webhook and MQTT sync)
    await recordAndPublish(
      "parts_inventory",
      item.id,
      "update",
      {
        ...item,
        action: "cost_update",
      },
      userId
    );

    return item;
  }

  /**
   * Update part stock quantities with event publishing
   */
  async updatePartStock(
    partId: string,
    updateData: {
      quantityOnHand?: number;
      quantityReserved?: number;
      minStockLevel?: number;
      maxStockLevel?: number;
    },
    userId?: string
  ): Promise<PartsInventory> {
    // Update stock
    const item = await inventoryRepository.updatePartStock(partId, updateData);

    // Publish events (recordAndPublish handles both webhook and MQTT sync)
    await recordAndPublish(
      "parts_inventory",
      item.id,
      "update",
      {
        ...item,
        action: "stock_update",
      },
      userId
    );

    return item;
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
    return inventoryRepository.checkAvailability(partId, quantity, orgId);
  }

  /**
   * Get compatible equipment for a part
   */
  async getCompatibleEquipment(partId: string, orgId: string): Promise<Equipment[]> {
    return inventoryRepository.findCompatibleEquipment(partId, orgId);
  }

  /**
   * Update part compatibility with equipment
   */
  async updateCompatibility(
    partId: string,
    equipmentIds: string[],
    orgId: string,
    userId?: string
  ): Promise<Part> {
    // Update compatibility
    const part = await inventoryRepository.updateCompatibility(partId, equipmentIds, orgId);

    // Publish event
    await recordAndPublish(
      "part",
      partId,
      "update",
      {
        ...part,
        action: "compatibility_update",
      },
      userId
    );

    return part;
  }

  /**
   * Get compatible parts for equipment
   */
  async getPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]> {
    return inventoryRepository.findPartsForEquipment(equipmentId, orgId);
  }

  /**
   * Get low stock parts
   */
  async getLowStockParts(orgId?: string): Promise<PartsInventory[]> {
    return inventoryRepository.findLowStockParts(orgId);
  }

  async listPartsInventoryPaginated(orgId: string, options: {
    limit?: number; offset?: number; search?: string; category?: string;
    criticality?: string; stockStatus?: string; supplier?: string;
    sortBy?: string; sortOrder?: "asc" | "desc";
  }): Promise<{ items: any[]; total: number }> {
    return dbInventoryStorage.getPartsInventoryPaginated(orgId, options);
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
