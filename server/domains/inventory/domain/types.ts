/**
 * Inventory Domain Types
 * Pure domain entities and value objects
 */

export interface PartEntity {
  id: string;
  partNo: string;
  description: string;
  category: string | null;
  manufacturer: string | null;
  unitCost: number | null;
  currency: string;
  leadTimeDays: number | null;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartsInventoryEntity {
  id: string;
  partNo: string;
  name: string;
  category: string | null;
  description: string | null;
  quantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  unitCost: number | null;
  currency: string;
  location: string | null;
  vesselId: string | null;
  equipmentId: string | null;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'on_order';
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovementEntity {
  id: string;
  inventoryId: string;
  movementType: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  userId: string | null;
  orgId: string;
  createdAt: Date;
}

export interface CreatePartCommand {
  partNo: string;
  description: string;
  category?: string;
  manufacturer?: string;
  unitCost?: number;
  currency?: string;
  leadTimeDays?: number;
  orgId: string;
}

export interface CreateInventoryItemCommand {
  partNo: string;
  name: string;
  category?: string;
  description?: string;
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  unitCost?: number;
  currency?: string;
  location?: string;
  vesselId?: string;
  equipmentId?: string;
  orgId: string;
}

export interface UpdateInventoryItemCommand {
  name?: string;
  category?: string;
  description?: string;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  unitCost?: number;
  currency?: string;
  location?: string;
  status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'on_order';
}

export interface RecordStockMovementCommand {
  inventoryId: string;
  movementType: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  userId?: string;
  orgId: string;
}
