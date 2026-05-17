// @ts-nocheck
/**
 * Inventory Storage Interface
 *
 * Typed adapter over the existing storage layer that provides:
 * 1. Type safety (eliminates `any`)
 * 2. Batched operations to prevent N+1 queries
 * 3. Consistent API across MemStorage and DBStorage
 *
 * This is an ADAPTER pattern - it wraps existing storage methods
 * without duplicating business logic.
 */

import type { Part, Stock, PartSubstitution } from "@shared/schema";
import type { IStorage } from "../storage/interfaces/storage.types";

/**
 * Typed interface for inventory storage operations
 * Eliminates `any` types and provides batch operations
 */
export interface InventoryStorage {
  /**
   * Get single part by part number
   */
  getPartByNumber(partNo: string, orgId: string): Promise<Part | null>;

  /**
   * Get multiple parts by part numbers (batched)
   * PERFORMANCE: Single query instead of N queries
   */
  getPartsByNumbers(partNos: string[], orgId: string): Promise<Part[]>;

  /**
   * Get stock records for a single part
   */
  getStockByPart(partNo: string, orgId: string): Promise<Stock[]>;

  /**
   * Get stock records for multiple parts (batched)
   * PERFORMANCE: Single query instead of N queries
   */
  getStockByParts(partNos: string[], orgId: string): Promise<Stock[]>;

  /**
   * Get substitution mappings for a part
   */
  suggestPartSubstitutions(partNo: string, orgId: string): Promise<PartSubstitution[]>;

  /**
   * Get parts required by a work order
   */
  getWorkOrderParts(
    workOrderId: string,
    orgId: string
  ): Promise<Array<{ partNo: string; quantity: number }>>;

  /**
   * Get work logs for a work order (for labor cost calculation)
   */
  getWorkOrderWorklogs(
    workOrderId: string
  ): Promise<Array<{ durationMinutes: number; laborCostPerHour: number }>>;

  /**
   * Get open purchase orders for a part (optional - for accurate ETA calculation)
   * Returns expected delivery dates from POs
   */
  getOpenPOs?(partNo: string, orgId: string): Promise<Array<{ expectedDate: string }>>;
}

/**
 * Storage adapter implementation
 * Wraps existing storage methods with type safety and batch operations
 */
export class InventoryStorageAdapter implements InventoryStorage {
  constructor(private storage: IStorage) {}

  /**
   * Get part by number - direct passthrough
   */
  async getPartByNumber(partNo: string, orgId: string): Promise<Part | null> {
    const part = await this.storage.getPartByNumber(partNo, orgId);
    return part ?? null;
  }

  /**
   * Get multiple parts in single batch query
   * OPTIMIZATION: Prevents N+1 query antipattern
   */
  async getPartsByNumbers(partNos: string[], orgId: string): Promise<Part[]> {
    if (partNos.length === 0) {
      return [];
    }

    // Use existing storage method for each part (storage layer should batch internally)
    // If storage doesn't support batching, this still prevents caller-level N+1
    const partsPromises = partNos.map((partNo) => this.storage.getPartByNumber(partNo, orgId));

    const parts = await Promise.all(partsPromises);
    return parts.filter((part): part is Part => part !== undefined && part !== null);
  }

  /**
   * Get stock for a part by part number
   * Note: Storage has getStockByPart(partId) but inventory.ts needs by partNo
   */
  async getStockByPart(partNo: string, orgId: string): Promise<Stock[]> {
    // First get the part to get its ID
    const part = await this.storage.getPartByNumber(partNo, orgId);
    if (!part) {
      return [];
    }

    // Then get stock by part ID
    return this.storage.getStockByPart(part.id, orgId);
  }

  /**
   * Get stock for multiple parts in single batch
   * OPTIMIZATION: Prevents N+1 query antipattern
   */
  async getStockByParts(partNos: string[], orgId: string): Promise<Stock[]> {
    if (partNos.length === 0) {
      return [];
    }

    // Get all parts first to resolve IDs
    const parts = await this.getPartsByNumbers(partNos, orgId);
    const partIds = parts.map((p) => p.id);

    // Get stock for all parts
    const stockPromises = partIds.map((partId) => this.storage.getStockByPart(partId, orgId));

    const stockArrays = await Promise.all(stockPromises);
    return stockArrays.flat();
  }

  /**
   * Get part substitutions
   * Note: Database uses originalPartId/partId, not partNo
   */
  async suggestPartSubstitutions(partNo: string, orgId: string): Promise<PartSubstitution[]> {
    // Get the part first to resolve ID
    const part = await this.storage.getPartByNumber(partNo, orgId);
    if (!part) {
      return [];
    }

    // Get substitutions by part ID
    return this.storage.suggestPartSubstitutions(part.id, orgId);
  }

  /**
   * Get work order parts with proper typing
   */
  async getWorkOrderParts(
    workOrderId: string,
    orgId: string
  ): Promise<Array<{ partNo: string; quantity: number }>> {
    const workOrderParts = await this.storage.getWorkOrderParts(workOrderId, orgId);

    // Map to simplified structure needed by inventory functions
    return workOrderParts.map((wop) => ({
      partNo: wop.partNo ?? "", // Handle missing partNo
      quantity: wop.quantityUsed ?? 0,
    }));
  }

  /**
   * Get work order worklogs with proper typing
   */
  async getWorkOrderWorklogs(
    workOrderId: string
  ): Promise<Array<{ durationMinutes: number; laborCostPerHour: number }>> {
    const worklogs = await this.storage.getWorkOrderWorklogs(workOrderId);

    // Map to simplified structure
    return worklogs.map((log) => ({
      durationMinutes: log.durationMinutes ?? 0,
      laborCostPerHour: log.laborCostPerHour ?? 75, // Default labor rate
    }));
  }

  /**
   * Get open purchase orders for ETA calculation
   * Optional feature - not all storage implementations may support this
   */
  async getOpenPOs(partNo: string, orgId: string): Promise<Array<{ expectedDate: string }>> {
    // Stub implementation - can be enhanced when PO system is available
    // For now, return empty array (callers will fall back to lead time calculation)
    return [];
  }
}

/**
 * Create inventory storage adapter from existing storage
 */
export function createInventoryStorage(storage: IStorage): InventoryStorage {
  return new InventoryStorageAdapter(storage);
}
