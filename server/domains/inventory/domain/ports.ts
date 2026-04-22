/**
 * Inventory Domain Ports
 * Interfaces defining the contract between domain and infrastructure
 */

import type {
  PartEntity,
  PartsInventoryEntity,
  StockMovementEntity,
  CreatePartCommand,
  CreateInventoryItemCommand,
  UpdateInventoryItemCommand,
  RecordStockMovementCommand,
} from "./types.js";
import type { InventoryDomainEvent } from "./events.js";

export interface IPartRepository {
  findAll(orgId?: string): Promise<PartEntity[]>;
  findByPartNo(partNo: string, orgId?: string): Promise<PartEntity | undefined>;
  findById(id: string, orgId?: string): Promise<PartEntity | undefined>;
  create(command: CreatePartCommand): Promise<PartEntity>;
  update(id: string, updates: Partial<PartEntity>): Promise<PartEntity>;
  delete(id: string): Promise<void>;
  syncCosts(partId: string): Promise<void>;
}

export interface IPartsInventoryRepository {
  findAll(
    category?: string,
    orgId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Promise<PartsInventoryEntity[]>;
  findById(id: string, orgId?: string): Promise<PartsInventoryEntity | undefined>;
  findByPartNo(partNo: string, orgId?: string): Promise<PartsInventoryEntity[]>;
  findLowStock(orgId: string): Promise<PartsInventoryEntity[]>;
  create(command: CreateInventoryItemCommand): Promise<PartsInventoryEntity>;
  update(
    id: string,
    updates: UpdateInventoryItemCommand,
    orgId?: string
  ): Promise<PartsInventoryEntity>;
  delete(id: string, orgId: string): Promise<void>;
  updateQuantity(id: string, newQuantity: number, orgId?: string): Promise<PartsInventoryEntity>;
}

export interface IStockMovementRepository {
  create(
    command: RecordStockMovementCommand,
    previousQuantity: number,
    newQuantity: number
  ): Promise<StockMovementEntity>;
  findByInventoryId(inventoryId: string): Promise<StockMovementEntity[]>;
  findByDateRange(orgId: string, startDate: Date, endDate: Date): Promise<StockMovementEntity[]>;
}

export interface IInventoryEventPublisher {
  publish(event: InventoryDomainEvent): Promise<void>;
  publishBatch(events: InventoryDomainEvent[]): Promise<void>;
}

export interface IInventoryAuditPort {
  recordAction(
    action: string,
    entityType: string,
    entityId: string,
    orgId: string,
    userId?: string,
    details?: Record<string, unknown>
  ): Promise<void>;
}

export interface WorkOrderPartDemand {
  partId: string;
  workOrderId: string;
  woNumber: string | null;
  quantityRequired: number;
  plannedStartDate: Date | null;
  priority: number;
  status: string;
}

export interface IWorkOrderDemandRepository {
  getUpcomingDemand(
    orgId: string,
    daysAhead?: number,
    vesselId?: string
  ): Promise<WorkOrderPartDemand[]>;
}
