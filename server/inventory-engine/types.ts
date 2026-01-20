/**
 * Inventory Engine - Types
 * 
 * Type definitions for inventory management operations.
 */

export interface PartAvailability {
  partNo: string;
  name: string;
  onHand: number;
  reserved: number;
  available: number;
  onOrder: number;
  minStock: number;
  maxStock: number;
  stockStatus: "adequate" | "low" | "critical" | "excess";
  leadTimeDays: number;
  estimatedRestockDate?: Date;
  locations: Array<{
    location: string;
    quantity: number;
    binLocation?: string;
  }>;
}

export interface SupplierPerformance {
  supplierId: string;
  name: string;
  onTimeDeliveryRate: number;
  qualityRating: number;
  averageLeadTime: number;
  totalOrders: number;
  lastDeliveryDate?: Date;
  performanceScore: number;
  status: "preferred" | "active" | "inactive" | "blacklisted";
}

export interface CostPlanningResult {
  totalCost: number;
  laborCost: number;
  materialCost: number;
  breakdown: Array<{
    taskId: string;
    description: string;
    partCosts: Array<{
      partNo: string;
      name: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      availability: "available" | "low_stock" | "out_of_stock" | "substitute_required";
      leadTime?: number;
    }>;
    laborHours: number;
    laborRate: number;
    taskLaborCost: number;
    taskMaterialCost: number;
    taskTotalCost: number;
  }>;
  recommendations: Array<{
    type: "substitution" | "bulk_purchase" | "expedited_delivery" | "supplier_change";
    description: string;
    potentialSavings?: number;
    riskLevel: "low" | "medium" | "high";
  }>;
}

export interface InventoryOptimization {
  partNo: string;
  currentStock: number;
  optimalStock: number;
  reorderPoint: number;
  economicOrderQuantity: number;
  annualDemand: number;
  holdingCost: number;
  orderingCost: number;
  stockoutCost: number;
  recommendation: "increase" | "decrease" | "maintain";
  potentialSavings: number;
}

export interface DeliveryHistoryRecord {
  supplierId: string;
  orderDate: Date;
  deliveryDate: Date;
  expectedDeliveryDate: Date;
  qualityScore: number;
}

export interface UsageHistoryRecord {
  partNo: string;
  monthlyUsage: number[];
}

export interface CostParameters {
  orderingCost: number;
  holdingCostRate: number;
  stockoutCostRate: number;
}

export interface OptimizationOptions {
  serviceLevel?: number;
  demandVariability?: number;
}
