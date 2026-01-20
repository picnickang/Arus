import type {
  PartsInventory,
  InsertPartsInventory,
  InventoryMovement,
  InsertInventoryMovement,
  Supplier,
  InsertSupplier,
} from "@shared/schema-runtime";

export interface InventoryFilters {
  category?: string;
  search?: string;
  lowStock?: boolean;
  equipmentId?: string;
  vesselId?: string;
  orgId?: string;
  limit?: number;
  offset?: number;
}

export interface MovementFilters {
  partId?: string;
  movementType?: "in" | "out" | "adjustment" | "transfer" | "reservation";
  startDate?: Date;
  endDate?: Date;
  workOrderId?: string;
  orgId?: string;
  limit?: number;
  offset?: number;
}

export interface IPartsInventoryStorage {
  getPartsInventory(filters?: InventoryFilters): Promise<PartsInventory[]>;
  getPartById(id: string, orgId?: string): Promise<PartsInventory | undefined>;
  getPartByNumber(partNumber: string, orgId?: string): Promise<PartsInventory | undefined>;
  createPart(part: InsertPartsInventory): Promise<PartsInventory>;
  updatePart(id: string, part: Partial<InsertPartsInventory>, orgId?: string): Promise<PartsInventory>;
  deletePart(id: string, orgId: string): Promise<void>;
  
  getLowStockParts(orgId?: string): Promise<PartsInventory[]>;
  getPartsByEquipment(equipmentId: string, orgId?: string): Promise<PartsInventory[]>;
  getPartsByCategory(category: string, orgId?: string): Promise<PartsInventory[]>;
  
  updateStock(id: string, quantity: number, orgId?: string): Promise<PartsInventory>;
  reserveStock(id: string, quantity: number, workOrderId: string, orgId?: string): Promise<PartsInventory>;
  releaseReservation(id: string, quantity: number, workOrderId: string, orgId?: string): Promise<PartsInventory>;
}

export interface IInventoryMovementStorage {
  getMovements(filters?: MovementFilters): Promise<InventoryMovement[]>;
  getMovement(id: string, orgId?: string): Promise<InventoryMovement | undefined>;
  createMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;
  
  getMovementsByPart(partId: string, orgId?: string): Promise<InventoryMovement[]>;
  getMovementsByWorkOrder(workOrderId: string, orgId?: string): Promise<InventoryMovement[]>;
  
  getMovementSummary(partId: string, period: "daily" | "weekly" | "monthly", orgId?: string): Promise<{
    totalIn: number;
    totalOut: number;
    netChange: number;
    movements: number;
  }>;
}

export interface ISupplierStorage {
  getSuppliers(orgId?: string): Promise<Supplier[]>;
  getSupplier(id: string, orgId?: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>, orgId?: string): Promise<Supplier>;
  deleteSupplier(id: string, orgId?: string): Promise<void>;
  
  getSuppliersByPart(partId: string, orgId?: string): Promise<Supplier[]>;
  getPreferredSupplier(partId: string, orgId?: string): Promise<Supplier | undefined>;
}

export interface IInventoryReorderStorage {
  getReorderSuggestions(orgId?: string): Promise<Array<{
    partId: string;
    partNumber: string;
    partName: string;
    currentStock: number;
    reorderPoint: number;
    suggestedQuantity: number;
    preferredSupplierId?: string;
  }>>;
  
  createReorderRequest(request: {
    partId: string;
    quantity: number;
    supplierId?: string;
    priority: "normal" | "urgent";
    notes?: string;
    orgId: string;
  }): Promise<{ requestId: string }>;
  
  getReorderHistory(partId: string, orgId?: string): Promise<Array<{
    id: string;
    quantity: number;
    status: string;
    createdAt: Date;
    fulfilledAt?: Date;
  }>>;
}

export interface IInventoryReportStorage {
  getInventoryValue(orgId?: string): Promise<{
    totalValue: number;
    byCategory: Record<string, number>;
    byVessel: Record<string, number>;
  }>;
  
  getStockTurnover(period: "monthly" | "quarterly" | "yearly", orgId?: string): Promise<Array<{
    partId: string;
    partNumber: string;
    turnoverRate: number;
    averageStock: number;
    totalConsumed: number;
  }>>;
  
  getDeadStock(thresholdDays: number, orgId?: string): Promise<Array<{
    partId: string;
    partNumber: string;
    lastMovementDate: Date;
    quantity: number;
    value: number;
  }>>;
}
