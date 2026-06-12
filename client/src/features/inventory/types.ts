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
