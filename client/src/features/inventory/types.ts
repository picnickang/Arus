export interface Part {
  id: string;
  orgId: string;
  partNumber: string;
  name: string;
  description?: string;
  category?: string;
  manufacturer?: string;
  unitOfMeasure?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  unitCost?: number;
  leadTimeDays?: number;
  criticality?: "low" | "medium" | "high" | "critical";
  compatibleEquipment?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InventoryPart {
  id: string;
  partId: string;
  vesselId?: string;
  warehouseId?: string;
  locationCode?: string;
  quantity: number;
  reservedQuantity?: number;
  lastCountDate?: Date;
  expiryDate?: Date;
}

export interface Stock {
  id: string;
  partId: string;
  vesselId?: string;
  quantity: number;
  location?: string;
  binNumber?: string;
  lastUpdated?: Date;
}

export interface InventoryMovement {
  id: string;
  partId: string;
  fromLocation?: string;
  toLocation?: string;
  quantity: number;
  movementType: "in" | "out" | "transfer" | "adjustment";
  reason?: string;
  workOrderId?: string;
  performedBy?: string;
  performedAt: Date;
}

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  leadTimeDays?: number;
  rating?: number;
  isPreferred?: boolean;
}

export interface PurchaseOrder {
  id: string;
  orgId: string;
  supplierId: string;
  status: "draft" | "submitted" | "approved" | "ordered" | "received" | "cancelled";
  orderDate?: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  totalAmount?: number;
  notes?: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  partId: string;
  quantity: number;
  unitPrice?: number;
  receivedQuantity?: number;
}

export const PART_CATEGORIES = [
  "Engine",
  "Deck",
  "Electrical",
  "Safety",
  "Navigation",
  "HVAC",
  "Plumbing",
  "General",
] as const;

export const CRITICALITY_LEVELS = ["low", "medium", "high", "critical"] as const;

export type PartCategory = typeof PART_CATEGORIES[number];
export type CriticalityLevel = typeof CRITICALITY_LEVELS[number];
