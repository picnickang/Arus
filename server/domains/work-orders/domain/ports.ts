/**
 * Work Orders Domain - Port Interfaces
 * Repository and service interfaces for dependency inversion
 */

import type {
  SelectWorkOrder,
  InsertWorkOrder,
  SelectWorkOrderPart,
  InsertWorkOrderPart,
  SelectWorkOrderTask,
  InsertWorkOrderTask,
  WorkOrderSearchCriteria,
  WorkOrderCostSummary,
} from "./types";
import type { WorkOrderDomainEvent } from "./events";

export interface IWorkOrderRepository {
  findAll(orgId?: string, vesselId?: string): Promise<SelectWorkOrder[]>;
  findById(id: string, orgId?: string): Promise<SelectWorkOrder | undefined>;
  findByCriteria(criteria: WorkOrderSearchCriteria): Promise<SelectWorkOrder[]>;
  create(data: InsertWorkOrder): Promise<SelectWorkOrder>;
  update(id: string, data: Partial<InsertWorkOrder>): Promise<SelectWorkOrder>;
  delete(id: string): Promise<void>;
  findByEquipment(equipmentId: string): Promise<SelectWorkOrder[]>;
  findOverdue(orgId?: string): Promise<SelectWorkOrder[]>;
}

export interface IWorkOrderPartRepository {
  findByWorkOrder(workOrderId: string): Promise<SelectWorkOrderPart[]>;
  findById(id: string): Promise<SelectWorkOrderPart | undefined>;
  create(data: InsertWorkOrderPart): Promise<SelectWorkOrderPart>;
  update(id: string, data: Partial<InsertWorkOrderPart>): Promise<SelectWorkOrderPart>;
  delete(id: string): Promise<void>;
  bulkCreate(workOrderId: string, parts: InsertWorkOrderPart[]): Promise<SelectWorkOrderPart[]>;
}

export interface IWorkOrderTaskRepository {
  findByWorkOrder(workOrderId: string): Promise<SelectWorkOrderTask[]>;
  findById(id: string): Promise<SelectWorkOrderTask | undefined>;
  create(data: InsertWorkOrderTask): Promise<SelectWorkOrderTask>;
  update(id: string, data: Partial<InsertWorkOrderTask>): Promise<SelectWorkOrderTask>;
  delete(id: string): Promise<void>;
  markComplete(id: string, completedBy?: string): Promise<SelectWorkOrderTask>;
}

export interface IWorkOrderCostRepository {
  getCostSummary(workOrderId: string): Promise<WorkOrderCostSummary>;
  getCostsByEquipment(equipmentId: string): Promise<WorkOrderCostSummary[]>;
  getFleetCosts(orgId: string, startDate?: Date, endDate?: Date): Promise<WorkOrderCostSummary[]>;
}

export interface IWorkOrderEventPublisher {
  /**
   * Publish a single work-order domain event. When `tx` is provided the
   * outbox enqueue runs inside the caller's transaction so the outbox
   * row commits or rolls back atomically with the business write
   * (true transactional outbox). Without `tx` the publish is still
   * durable via the outbox but is committed on its own connection —
   * callers that need atomic semantics MUST pass `tx`.
   */
  publish(event: WorkOrderDomainEvent, tx?: unknown): Promise<void>;
  publishBatch(events: WorkOrderDomainEvent[], tx?: unknown): Promise<void>;
}
