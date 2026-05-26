import type {
  IWorkOrderRepository,
  IWorkOrderEventPublisher,
  SelectWorkOrder,
  InsertWorkOrder,
  WorkOrderSearchCriteria,
} from "../domain";
import { workOrderRepository } from "../repository";
import { db } from "../../../db.js";
import type { InsertWorkOrderCompletion, WorkOrderCompletion } from "@shared/schema";
import { fireInventoryMovementProjections } from "../../../db/inventory/index.js";
import { broadcastChange } from "../../../db/workorders/types.js";

type WorkOrderPriority = "low" | "medium" | "high" | "critical";
const VALID_PRIORITIES = new Set<WorkOrderPriority>(["low", "medium", "high", "critical"]);
function normalizePriority(p: unknown): WorkOrderPriority {
  return typeof p === "string" && VALID_PRIORITIES.has(p as WorkOrderPriority)
    ? (p as WorkOrderPriority)
    : "medium";
}

export interface WorkOrderServiceDependencies {
  workOrderRepository: IWorkOrderRepository;
  eventPublisher: IWorkOrderEventPublisher;
}

export class WorkOrderApplicationService {
  constructor(private deps: WorkOrderServiceDependencies) {}

  async listWorkOrders(
    equipmentId?: string,
    orgId?: string,
    filters?: Record<string, unknown>,
  ): Promise<SelectWorkOrder[]> {
    return workOrderRepository.findAll(equipmentId, orgId, filters);
  }

  async listWorkOrdersPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: Record<string, unknown>,
  ): Promise<{ items: SelectWorkOrder[]; total: number }> {
    return workOrderRepository.findPaginated(equipmentId, orgId, limit, offset, filters);
  }

  async getWorkOrderById(id: string, orgId?: string): Promise<SelectWorkOrder | undefined> {
    return workOrderRepository.findById(id, orgId as string);
  }

  async searchWorkOrders(criteria: WorkOrderSearchCriteria): Promise<SelectWorkOrder[]> {
    return this.deps.workOrderRepository.findByCriteria(criteria);
  }

  async createWorkOrder(data: InsertWorkOrder, userId?: string): Promise<SelectWorkOrder> {
    // True transactional outbox: the WO insert and the outbox enqueue
    // commit or roll back together. The in-process bus emit is
    // deferred — `publisher.publish(event, tx)` returns a thunk that
    // we ONLY invoke after `db.transaction(...)` resolves. If the tx
    // rolls back the thunk is never called, so existing in-process
    // subscribers never observe an uncommitted event.
    let postCommit: (() => void) | null = null;
    const workOrder = await db.transaction(async (tx) => {
      const created = await workOrderRepository.create(data, tx);
      postCommit = await this.deps.eventPublisher.publish(
        {
          type: "WORK_ORDER_CREATED",
          workOrderId: created.id,
          orgId: created.orgId || "default",
          vesselId: created.vesselId || undefined,
          equipmentId: created.equipmentId || undefined,
          priority: normalizePriority(created.priority),
          timestamp: new Date(),
        },
        tx
      );
      return created;
    });
    if (postCommit) (postCommit as () => void)();
    // LR-3.5 / TX-1: WS "create" broadcast is now owned by the
    // application service rather than `DbWorkOrderCore.createWorkOrder`,
    // because the db-layer broadcast would fire pre-commit when called
    // with a caller-supplied `tx`. The db layer suppresses its own
    // broadcast when `tx` is present and we fire it here, AFTER
    // `db.transaction(...)` resolves. On rollback we never reach this
    // line, so clients never observe a work order that doesn't exist.
    broadcastChange("create", workOrder as unknown as Record<string, unknown>);

    return workOrder;
  }

  async createWorkOrderWithSuggestions(
    data: InsertWorkOrder,
    orgId: string,
    userId?: string
  ): Promise<SelectWorkOrder> {
    return this.createWorkOrder(data, userId);
  }

  async updateWorkOrder(
    id: string,
    data: Partial<InsertWorkOrder>,
    orgId?: string,
    userId?: string
  ): Promise<SelectWorkOrder> {
    const previous = await workOrderRepository.findById(id, orgId as string);
    const workOrder = await workOrderRepository.update(id, data);
    const resolvedOrgId = workOrder.orgId || orgId || "default";

    if (data.status && previous && data.status !== previous.status) {
      await this.deps.eventPublisher.publish({
        type: "WORK_ORDER_STATUS_CHANGED",
        workOrderId: workOrder.id,
        orgId: resolvedOrgId,
        previousStatus: previous.status || "draft",
        newStatus: data.status,
        changedBy: userId,
        timestamp: new Date(),
      });

      if (data.status === "cancelled") {
        const { voidSavingsForWorkOrder } = await import("../../../cost-savings-engine");
        await voidSavingsForWorkOrder(workOrder.id, resolvedOrgId, "Work order cancelled.", userId);
      } else if (previous.status === "completed" && data.status !== "completed") {
        const { voidSavingsForWorkOrder } = await import("../../../cost-savings-engine");
        await voidSavingsForWorkOrder(
          workOrder.id,
          resolvedOrgId,
          "Work order reopened after completion.",
          userId
        );
      }
    } else {
      await this.deps.eventPublisher.publish({
        type: "WORK_ORDER_UPDATED",
        workOrderId: workOrder.id,
        orgId: resolvedOrgId,
        changes: data,
        timestamp: new Date(),
      });
    }

    return workOrder;
  }

  async deleteWorkOrder(id: string, orgId?: string, userId?: string): Promise<void> {
    await workOrderRepository.delete(id);
  }

  async completeWorkOrder(
    workOrderId: string,
    completionData: InsertWorkOrderCompletion,
    orgId?: string,
    userId?: string,
  ): Promise<WorkOrderCompletion> {
    // Transactional-outbox: the completion write (work_orders update +
    // work_order_completions insert + inventory_movements rows) and the
    // outbox enqueue commit or roll back together. The in-process bus
    // emit is deferred — `publisher.publish(event, tx)` returns a thunk
    // we only invoke after `db.transaction(...)` resolves, so existing
    // subscribers never observe an event from a tx that rolled back.
    // Inventory-movement projections also fire only post-commit to keep
    // the graph from leading relational truth (Task #81 invariant).
    let postCommit: (() => void) | null = null;
    const pendingProjections: Awaited<
      ReturnType<typeof workOrderRepository.completeInTx>
    >["pendingProjections"] = [];
    const completion = await db.transaction(async (tx) => {
      const r = await workOrderRepository.completeInTx(tx, workOrderId, completionData);
      pendingProjections.push(...r.pendingProjections);
      postCommit = await this.deps.eventPublisher.publish(
        {
          type: "WORK_ORDER_COMPLETED",
          workOrderId,
          orgId: orgId || completionData.orgId || "default",
          completedBy: userId,
          timestamp: new Date(),
        },
        tx
      );
      return r.completion;
    });
    if (postCommit) {
      (postCommit as () => void)();
    }
    if (pendingProjections.length > 0 && completionData.orgId) {
      await fireInventoryMovementProjections(completionData.orgId, pendingProjections);
    }
    return completion;
  }

  async getOverdueWorkOrders(orgId?: string): Promise<SelectWorkOrder[]> {
    return this.deps.workOrderRepository.findOverdue(orgId);
  }

  async cloneWorkOrder(
    workOrderId: string,
    orgId: string,
    options: Record<string, unknown>,
  ): Promise<SelectWorkOrder> {
    return workOrderRepository.cloneWorkOrder(workOrderId, orgId, options);
  }

  async getWorkOrderHistory(
    workOrderId: string,
    orgId: string,
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.getWorkOrderHistory>>> {
    return workOrderRepository.getWorkOrderHistory(workOrderId, orgId);
  }

  async getInventoryMovementsByWorkOrder(
    workOrderId: string,
    orgId: string,
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.getInventoryMovementsByWorkOrder>>> {
    return workOrderRepository.getInventoryMovementsByWorkOrder(workOrderId, orgId);
  }

  async createMaintenanceCost(
    data: Parameters<typeof workOrderRepository.createMaintenanceCost>[0],
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.createMaintenanceCost>>> {
    return workOrderRepository.createMaintenanceCost(data);
  }

  async getMaintenanceCostsByWorkOrder(
    workOrderId: string,
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.getMaintenanceCostsByWorkOrder>>> {
    return workOrderRepository.getMaintenanceCostsByWorkOrder(workOrderId);
  }

  async getWorkOrderParts(
    workOrderId: string,
    orgId: string,
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.getWorkOrderParts>>> {
    return workOrderRepository.getWorkOrderParts(workOrderId, orgId);
  }

  async addPartToWorkOrder(
    workOrderId: string,
    partsToAdd: Parameters<typeof workOrderRepository.addPartToWorkOrder>[1],
    orgId: string,
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.addPartToWorkOrder>>> {
    return workOrderRepository.addPartToWorkOrder(workOrderId, partsToAdd, orgId);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    parts: Parameters<typeof workOrderRepository.addBulkPartsAndReserveInventory>[1],
    orgId: string,
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.addBulkPartsAndReserveInventory>>> {
    return workOrderRepository.addBulkPartsAndReserveInventory(workOrderId, parts, orgId);
  }

  async updateWorkOrderPart(
    partId: string,
    data: Parameters<typeof workOrderRepository.updateWorkOrderPart>[1],
  ): Promise<Awaited<ReturnType<typeof workOrderRepository.updateWorkOrderPart>>> {
    return workOrderRepository.updateWorkOrderPart(partId, data);
  }

  async removePartAndRestoreInventory(
    workOrderPartId: string,
    orgId: string,
    performedBy: string
  ): Promise<void> {
    return workOrderRepository.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy);
  }

  async getPartsCostForWorkOrder(workOrderId: string): Promise<unknown> {
    return workOrderRepository.getPartsCostForWorkOrder(workOrderId);
  }

  async getWorkOrderTasks(workOrderId: string, orgId: string): Promise<unknown[]> {
    return workOrderRepository.getWorkOrderTasks(workOrderId, orgId);
  }

  async createWorkOrderTask(data: Parameters<typeof workOrderRepository.createWorkOrderTask>[0]): Promise<unknown> {
    return workOrderRepository.createWorkOrderTask(data);
  }

  async updateWorkOrderTask(id: string, data: Parameters<typeof workOrderRepository.updateWorkOrderTask>[1]): Promise<unknown> {
    return workOrderRepository.updateWorkOrderTask(id, data);
  }

  async deleteWorkOrderTask(id: string): Promise<void> {
    return workOrderRepository.deleteWorkOrderTask(id);
  }

  async getCompletions(
    filters: Parameters<typeof workOrderRepository.getWorkOrderCompletions>[0],
  ): Promise<WorkOrderCompletion[]> {
    return workOrderRepository.getWorkOrderCompletions(filters);
  }

  async getWorkOrderCompletionAnalytics(
    filters: Parameters<typeof workOrderRepository.getWorkOrderCompletionAnalytics>[0],
  ): Promise<unknown> {
    return workOrderRepository.getWorkOrderCompletionAnalytics(filters);
  }

  async getWorkOrderCompletion(id: string): Promise<unknown> {
    return workOrderRepository.getWorkOrderCompletion(id);
  }

  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<unknown[]> {
    return workOrderRepository.getWorkOrderCompletionsByWorkOrder(workOrderId);
  }
}
