/**
 * Inventory Risk - Types
 * Shared type definitions for inventory risk analysis
 */

export interface PartRiskScore {
  partId: string;
  partNumber: string;
  partName: string;
  category: string;

  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  stockoutRisk: number;

  leadTimeDays: number;
  supplierName: string | null;
  supplierDependency: number;

  unitCost: number;
  totalValue: number;
  reorderCost: number;

  criticalEquipment: string[];
  equipmentCount: number;

  overallRisk: number;
  riskCategory: "low" | "medium" | "high" | "critical";
  recommendations: string[];
}

export interface InventoryRiskSummary {
  totalParts: number;
  activeSuppliers: number;
  totalValue: number;

  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  topRiskParts: PartRiskScore[];
  criticalStockouts: PartRiskScore[];
  highValueRisks: PartRiskScore[];
  supplierConcentration: Array<{
    supplierName: string;
    partCount: number;
    totalValue: number;
    riskScore: number;
  }>;
}

export interface EquipmentPartsRisk {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;

  totalParts: number;
  criticalParts: number;
  partsAtRisk: PartRiskScore[];

  maintenanceRisk: number;
  downTimeRisk: number;
  overallRisk: number;

  estimatedDowntimeCost: number;
  partsValue: number;

  recommendations: string[];
}

export interface SupplierConcentration {
  supplierName: string;
  partCount: number;
  totalValue: number;
  riskScore: number;
}
