/**
 * Supplier Types
 * Type definitions for supplier management (includes suppliers and service providers)
 */

import type { Supplier, InsertSupplier } from "@shared/schema";

export type { Supplier, InsertSupplier };

export type SupplierType = "supplier" | "service_provider" | "both";

export interface SupplierListFilters {
  orgId: string;
  search?: string;
  isActive?: boolean;
  isPreferred?: boolean;
  type?: SupplierType | SupplierType[];
  limit?: number;
  offset?: number;
}

export interface SupplierPerformanceMetrics {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  onTimeDeliveryRate: number;
  defectRate: number;
  averageLeadTimeDays: number;
  qualityRating: number;
  totalSpend: number;
}

export interface SupplierWithStats extends Supplier {
  orderCount?: number;
  lastOrderDate?: Date | null;
}
