/**
 * Parts Inventory Repository Adapter
 * Implements IPartsInventoryRepository using existing storage
 */

import type { IPartsInventoryRepository } from "../domain/ports.js";
import type {
  PartsInventoryEntity,
  CreateInventoryItemCommand,
  UpdateInventoryItemCommand,
} from "../domain/types.js";
import { inventoryRepository } from "../repository";

function mapToEntity(item: any): PartsInventoryEntity {
  return {
    id: item.id,
    partNo: item.partNo,
    name: item.name,
    category: item.category,
    description: item.description,
    quantity: item.quantity ?? 0,
    minQuantity: item.minQuantity ?? 0,
    maxQuantity: item.maxQuantity,
    unitCost: item.unitCost,
    currency: item.currency ?? "USD",
    location: item.location,
    vesselId: item.vesselId,
    equipmentId: item.equipmentId,
    status: item.status ?? "in_stock",
    orgId: item.orgId,
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
  };
}

export class PartsInventoryRepositoryAdapter implements IPartsInventoryRepository {
  async findAll(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PartsInventoryEntity[]> {
    const items = await inventoryRepository.findPartsInventory(
      category,
      orgId,
      search,
      sortBy,
      sortOrder
    );
    return items.map(mapToEntity);
  }

  async findById(id: string, orgId?: string): Promise<PartsInventoryEntity | undefined> {
    const item = await inventoryRepository.findInventoryById(id, orgId);
    return item ? mapToEntity(item) : undefined;
  }

  async findByPartNo(partNo: string, orgId?: string): Promise<PartsInventoryEntity[]> {
    const allItems = await inventoryRepository.findPartsInventory(undefined, orgId);
    return allItems.filter((item: any) => item.partNo === partNo).map(mapToEntity);
  }

  async findLowStock(orgId: string): Promise<PartsInventoryEntity[]> {
    const items = await inventoryRepository.findLowStockParts(orgId);
    return items.map(mapToEntity);
  }

  async create(command: CreateInventoryItemCommand): Promise<PartsInventoryEntity> {
    const item = await inventoryRepository.createInventoryItem(command as any);
    return mapToEntity(item);
  }

  async update(
    id: string,
    updates: UpdateInventoryItemCommand,
    orgId?: string
  ): Promise<PartsInventoryEntity> {
    const item = await inventoryRepository.updateInventoryItem(id, updates as any, orgId);
    return mapToEntity(item);
  }

  async delete(id: string, orgId: string): Promise<void> {
    // @ts-ignore -- bulk-silence
    await inventoryRepository.deleteInventoryItem(id, orgId);
  }

  async updateQuantity(
    id: string,
    newQuantity: number,
    orgId?: string
  ): Promise<PartsInventoryEntity> {
    const item = await inventoryRepository.updateInventoryItem(
      id,
      // @ts-ignore -- bulk-silence
      { quantity: newQuantity },
      orgId
    );
    return mapToEntity(item);
  }
}

export const partsInventoryRepository = new PartsInventoryRepositoryAdapter();
