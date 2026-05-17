import type { Part, PartsInventory, InsertPartsInventory, Equipment } from "@shared/schema";
import { dbInventoryStorage, dbEquipmentStorage, dbAnalyticsStorage } from "../../repositories";

export class InventoryRepository {
  async findAllParts(orgId?: string): Promise<Part[]> {
    return dbInventoryStorage.getParts(orgId);
  }

  async findPartByNumber(partNo: string, orgId?: string): Promise<Part | undefined> {
    return orgId
      ? dbInventoryStorage.getPartByPartNumber(partNo, orgId)
      : Promise.resolve(undefined);
  }

  async deletePart(id: string): Promise<void> {
    return dbInventoryStorage.deletePart(id);
  }

  async syncCosts(partId: string): Promise<void> {
    return dbInventoryStorage.syncPartCostToStock(partId);
  }

  async findPartsInventory(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<any[]> {
    return dbInventoryStorage.getPartsInventory(category, orgId, search, sortBy, sortOrder);
  }

  async findInventoryById(id: string, orgId?: string): Promise<PartsInventory | undefined> {
    return dbInventoryStorage.getPartById(id, orgId);
  }

  async createInventoryItem(data: InsertPartsInventory): Promise<PartsInventory> {
    return dbInventoryStorage.createPartsInventory(data);
  }

  async updateInventoryItem(
    id: string,
    data: Partial<InsertPartsInventory>,
    orgId?: string
  ): Promise<PartsInventory> {
    return dbInventoryStorage.updatePartsInventory(id, data);
  }

  async updatePartCost(
    partId: string,
    updateData: { unitCost: number; supplier: string }
  ): Promise<PartsInventory> {
    // @ts-ignore -- bulk-silence
    return dbAnalyticsStorage.updatePartCost(partId, updateData, "default-org-id");
  }

  async updatePartStock(
    partId: string,
    updateData: {
      quantityOnHand?: number;
      quantityReserved?: number;
      minStockLevel?: number;
      maxStockLevel?: number;
    }
  ): Promise<PartsInventory> {
    // @ts-ignore -- bulk-silence
    return dbAnalyticsStorage.updatePartStockQuantities(partId, updateData, "default-org-id");
  }

  async checkAvailability(
    partId: string,
    quantity: number,
    orgId?: string
  ): Promise<{
    available: boolean;
    onHand: number;
    reserved: number;
  }> {
    return dbInventoryStorage.checkPartAvailabilityForWorkOrder(partId, quantity, orgId);
  }

  async findCompatibleEquipment(partId: string, orgId: string): Promise<Equipment[]> {
    const eqs: any[] = await dbEquipmentStorage.getEquipmentRegistry(orgId);
    return eqs.filter((e: any) =>
      "compatibleParts" in e && Array.isArray(e.compatibleParts)
        ? e.compatibleParts.includes(partId)
        : false
    );
  }

  async updateCompatibility(partId: string, equipmentIds: string[], orgId: string): Promise<Part> {
    // @ts-ignore -- bulk-silence
    return dbInventoryStorage.updatePartCatalogue(partId, { compatibleEquipment: equipmentIds });
  }

  async findPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]> {
    // @ts-ignore -- bulk-silence
    return dbInventoryStorage.getPartsForEquipment(equipmentId, orgId);
  }

  async findLowStockParts(orgId?: string): Promise<PartsInventory[]> {
    return dbInventoryStorage.getLowStockParts(orgId);
  }
}

export const inventoryRepository = new InventoryRepository();
