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

/**
 * Optional post-commit hook returned by `publish(event, tx)` when a tx
 * is supplied. The caller MUST invoke it after the surrounding
 * transaction has actually committed so in-process subscribers do not
 * observe events from a tx that may still roll back.
 */
export type PostCommitEmit = () => void;

export interface IWorkOrderEventPublisher {
  /**
   * Publish a single work-order domain event using the transactional-
   * outbox pattern.
   *
   * - With `tx`: enqueues the envelope into `event_outbox` inside the
   *   caller's transaction (atomic with the business write) and
   *   returns a `PostCommitEmit` thunk. The in-process bus emit is
   *   deferred — the caller MUST invoke the thunk *after* the
   *   surrounding `db.transaction(...)` returns successfully. If the
   *   transaction rolls back, the thunk must NOT be called.
   * - Without `tx`: enqueues on the default connection and emits to
   *   the in-process bus immediately (legacy fast path); returns null
   *   because there is nothing to defer.
   */
  publish(event: WorkOrderDomainEvent, tx?: unknown): Promise<PostCommitEmit | null>;
  publishBatch(events: WorkOrderDomainEvent[], tx?: unknown): Promise<PostCommitEmit | null>;
}
