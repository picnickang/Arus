import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Inventory Storage Interface - Parts, Inventory, Movements
 * Part of IStorage modularization for improved maintainability
 */

import type { Part, PartsInventory, InsertPartsInventory, Equipment, Stock } from "@shared/schema";

/**
 * Inventory storage operations for parts management
 */
export interface IInventoryStorage {
  // Parts Inventory
  getPartsInventory(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PartsInventory[]>;
  getPartsInventoryPaginated(
    orgId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      category?: string;
      criticality?: string;
      stockStatus?: "all" | "low" | "critical" | "zero" | "excess" | "adequate";
      supplier?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<{ items: PartsInventory[]; total: number }>;
  getPartById(id: string, orgId?: string): Promise<PartsInventory | undefined>;
  createPart(part: InsertPartsInventory): Promise<PartsInventory>;
  updatePart(
    id: string,
    part: WidenPartial<InsertPartsInventory>,
    orgId: string
  ): Promise<PartsInventory>;
  deletePart(id: string, orgId: string): Promise<void>;
  getLowStockParts(orgId?: string): Promise<PartsInventory[]>;
  reservePart(partId: string, quantity: number): Promise<PartsInventory>;

  // Part Cost & Stock
  updatePartCost(
    partId: string,
    updateData: { unitCost: number; supplier: string },
    orgId: string
  ): Promise<PartsInventory>;
  updatePartStockQuantities(
    partId: string,
    updateData: {
      quantityOnHand?: number;
      quantityReserved?: number;
      minStockLevel?: number;
      maxStockLevel?: number;
    },
    orgId: string
  ): Promise<PartsInventory>;

  // Part-Equipment Relationships
  getPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]>;
  getEquipmentForPart(partId: string, orgId: string): Promise<Equipment[]>;
  updatePartCompatibility(partId: string, equipmentIds: string[], orgId: string): Promise<Part>;
  suggestPartsForSensorIssue(
    equipmentId: string,
    sensorType: string,
    orgId: string
  ): Promise<Part[]>;
  getEquipmentWithSensorIssues(
    orgId: string,
    severityFilter?: "warning" | "critical"
  ): Promise<
    Array<{
      equipment: Equipment;
      sensors: Array<{ sensorType: string; status: string; value: number | null }>;
    }>
  >;

  // Part Availability & Reservations
  checkPartAvailability(
    partId: string,
    quantityRequired: number,
    orgId?: string
  ): Promise<{
    available: boolean;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
    estimatedLeadTimeDays?: number;
    alternativeSuppliers?: string[];
  }>;
  checkMultiplePartsAvailability(
    parts: Array<{ partId: string; quantity: number }>,
    orgId?: string
  ): Promise<Map<string, boolean>>;
  reserveInventoryForWorkOrder(
    workOrderId: string,
    items: Array<{ partId: string; quantity: number }>,
    orgId?: string
  ): Promise<void>;
  cancelReservation(workOrderId: string, orgId?: string): Promise<void>;
  suggestPartSubstitutions(partId: string, orgId: string): Promise<Part[]>;

  // Part lookup by number (used by inventory adapter and engines)
  getPartByPartNo(partNo: string, orgId?: string): Promise<Part | undefined>;
  getPartsByNumbers(partNumbers: string[], orgId: string): Promise<Part[]>;
  getStockByPart(partId: string, orgId?: string): Promise<Stock[]>;
  getStockByParts(partIds: string[], orgId: string): Promise<Stock[]>;
  getStockByPartNumber(partNo: string, orgId?: string): Promise<Stock[]>;
}
