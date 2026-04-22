/**
 * Inventory/Parts - Types
 */

export type {
  Part,
  InsertPart,
  PartsInventory,
  InsertPartsInventory,
  Supplier,
  InsertSupplier,
  Stock,
  InsertStock,
  PartSubstitution,
  InsertPartSubstitution,
} from "@shared/schema-runtime";

export interface PartFilters {
  category?: string;
  location?: string;
  minStock?: number;
  maxStock?: number;
  equipmentId?: string;
}
export interface StockFilters {
  partId?: string;
  vesselId?: string;
  location?: string;
}
export interface AvailabilityResult {
  available: boolean;
  quantityOnHand: number;
  quantityReserved: number;
}
