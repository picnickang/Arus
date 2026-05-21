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
import { dbInventoryStorage } from "../../../db/inventory/index.js";

type InventoryRow = {
  id: string;
  partNo?: string;
  partNumber?: string;
  name?: string;
  partName?: string;
  category?: string | null;
  description?: string | null;
  quantity?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  unitCost?: number | null;
  currency?: string | null;
  location?: string | null;
  vesselId?: string | null;
  equipmentId?: string | null;
  status?: string | null;
  orgId: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function mapToEntity(raw: unknown): PartsInventoryEntity {
  const item = raw as InventoryRow;
  return {
    id: item.id,
    partNo: item.partNo ?? item.partNumber ?? "",
    name: item.name ?? item.partName ?? "",
    category: item.category ?? null,
    description: item.description ?? null,
    quantity: item.quantity ?? 0,
    minQuantity: item.minQuantity ?? 0,
    maxQuantity: item.maxQuantity ?? null,
    unitCost: item.unitCost ?? null,
    currency: item.currency ?? "USD",
    location: item.location ?? null,
    vesselId: item.vesselId ?? null,
    equipmentId: item.equipmentId ?? null,
    status: (item.status as PartsInventoryEntity["status"]) ?? "in_stock",
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
    return allItems
      .map(mapToEntity)
      .filter((entity) => entity.partNo === partNo);
  }

  async findLowStock(orgId: string): Promise<PartsInventoryEntity[]> {
    const items = await inventoryRepository.findLowStockParts(orgId);
    return items.map(mapToEntity);
  }

  async create(command: CreateInventoryItemCommand): Promise<PartsInventoryEntity> {
    const payload = {
      ...command,
      partNumber: command.partNo,
      partName: command.name,
    };
    const item = await inventoryRepository.createInventoryItem(
      payload as object as Parameters<typeof inventoryRepository.createInventoryItem>[0]
    );
    return mapToEntity(item);
  }

  async update(
    id: string,
    updates: UpdateInventoryItemCommand,
    orgId?: string
  ): Promise<PartsInventoryEntity> {
    const item = await inventoryRepository.updateInventoryItem(
      id,
      updates as object as Parameters<typeof inventoryRepository.updateInventoryItem>[1],
      orgId
    );
    return mapToEntity(item);
  }

  async delete(id: string, orgId: string): Promise<void> {
    await dbInventoryStorage.deletePartsInventory(id, orgId);
  }

  async updateQuantity(
    id: string,
    newQuantity: number,
    orgId?: string
  ): Promise<PartsInventoryEntity> {
    const item = await inventoryRepository.updateInventoryItem(
      id,
      { quantity: newQuantity } as object as Parameters<typeof inventoryRepository.updateInventoryItem>[1],
      orgId
    );
    return mapToEntity(item);
  }
}

export const partsInventoryRepository = new PartsInventoryRepositoryAdapter();
