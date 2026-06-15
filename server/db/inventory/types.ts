/**
 * Inventory/Parts - Types
 */

export interface PartFilters {
  category?: string | undefined;
  location?: string | undefined;
  minStock?: number | undefined;
  maxStock?: number | undefined;
  equipmentId?: string | undefined;
}
export interface StockFilters {
  partId?: string | undefined;
  vesselId?: string | undefined;
  location?: string | undefined;
}
export interface AvailabilityResult {
  available: boolean;
  quantityOnHand: number;
  quantityReserved: number;
}
