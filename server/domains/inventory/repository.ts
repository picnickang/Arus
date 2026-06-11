import type { WidenPartial } from "../../lib/widen-partial";
import type { Part, PartsInventory, InsertPartsInventory, Equipment } from "@shared/schema";
// Push B4: inventory domain imports its data adapters directly from
// `server/db/<domain>` — not from the legacy `server/repositories.ts`
// service-locator barrel. This removes inventory from the proxy's
// "architectural drift trap".
import { dbInventoryStorage } from "../../db/inventory/index.js";
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import { dbAnalyticsStorage } from "../../db/analytics/index.js";

export class InventoryRepository {
  async findAllParts(orgId?: string): Promise<Part[]> {
    return dbInventoryStorage.getParts(orgId);
  }

  async findPartByNumber(partNo: string, orgId?: string): Promise<Part | undefined> {
    return orgId
      ? dbInventoryStorage.getPartByPartNumber(partNo, orgId)
      : Promise.resolve(undefined);
  }

  async findPartById(id: string, orgId?: string): Promise<Part | undefined> {
    return dbInventoryStorage.getPart(id, orgId);
  }

  async deletePart(id: string, orgId: string): Promise<void> {
    return dbInventoryStorage.deletePart(id, orgId);
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
  ): Promise<PartsInventory[]> {
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
    data: WidenPartial<InsertPartsInventory>,
    orgId?: string
  ): Promise<PartsInventory> {
    return dbInventoryStorage.updatePartsInventory(id, data);
  }

  async updatePartCost(
    partId: string,
    updateData: { unitCost: number; supplier: string }
  ): Promise<PartsInventory> {
    return dbAnalyticsStorage.updatePartCost(
      partId,
      updateData,
      "default-org-id"
    ) as object as Promise<PartsInventory>;
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
    return dbAnalyticsStorage.updatePartStockQuantities(
      partId,
      updateData,
      "default-org-id"
    ) as object as Promise<PartsInventory>;
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
    const eqs = await dbEquipmentStorage.getEquipmentRegistry(orgId);
    return eqs.filter((e) => {
      const bag = e as Equipment & { compatibleParts?: unknown };
      return Array.isArray(bag.compatibleParts) && bag.compatibleParts.includes(partId);
    });
  }

  async updateCompatibility(partId: string, equipmentIds: string[], _orgId: string): Promise<Part> {
    const existing = await dbInventoryStorage.getPart(partId, _orgId);
    if (!existing) {
      throw new Error(`Part ${partId} not found`);
    }
    return dbInventoryStorage.updatePart(
      partId,
      { compatibleEquipment: equipmentIds } as Parameters<typeof dbInventoryStorage.updatePart>[1],
      _orgId
    );
  }

  async findPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]> {
    const allParts = await dbInventoryStorage.getParts(orgId);
    return allParts.filter((p) => {
      const bag = p as Part & { compatibleEquipment?: unknown };
      return (
        Array.isArray(bag.compatibleEquipment) && bag.compatibleEquipment.includes(equipmentId)
      );
    });
  }

  async findLowStockParts(orgId?: string): Promise<PartsInventory[]> {
    return dbInventoryStorage.getLowStockParts(orgId);
  }
}

export const inventoryRepository = new InventoryRepository();
