import type {
  IWorkOrderRepository,
  IWorkOrderEventPublisher,
  SelectWorkOrder,
  InsertWorkOrder,
  WorkOrderSearchCriteria,
} from "../domain";
import { workOrderRepository } from "../repository";
import { db } from "../../../db.js";

export interface WorkOrderServiceDependencies {
  workOrderRepository: IWorkOrderRepository;
  eventPublisher: IWorkOrderEventPublisher;
}

export class WorkOrderApplicationService {
  constructor(private deps: WorkOrderServiceDependencies) {}

  async listWorkOrders(
    equipmentId?: string,
    orgId?: string,
    filters?: any
  ): Promise<SelectWorkOrder[]> {
    return workOrderRepository.findAll(equipmentId, orgId, filters);
  }

  async listWorkOrdersPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: any
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
          priority: (created.priority as any) || "medium",
          timestamp: new Date(),
        },
        tx
      );
      return created;
    });
    if (postCommit) (postCommit as () => void)();

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
    completionData: any,
    orgId?: string,
    userId?: string
  ): Promise<any> {
    const completion = await workOrderRepository.complete(workOrderId, completionData);

    await this.deps.eventPublisher.publish({
      type: "WORK_ORDER_COMPLETED",
      workOrderId,
      orgId: orgId || "default",
      completedBy: userId,
      timestamp: new Date(),
    });

    return completion;
  }

  async getOverdueWorkOrders(orgId?: string): Promise<SelectWorkOrder[]> {
    return this.deps.workOrderRepository.findOverdue(orgId);
  }

  async cloneWorkOrder(workOrderId: string, orgId: string, options: any): Promise<SelectWorkOrder> {
    return workOrderRepository.cloneWorkOrder(workOrderId, orgId, options);
  }

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<any[]> {
    return workOrderRepository.getWorkOrderHistory(workOrderId, orgId);
  }

  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<any[]> {
    return workOrderRepository.getInventoryMovementsByWorkOrder(workOrderId, orgId);
  }

  async createMaintenanceCost(data: any): Promise<any> {
    return workOrderRepository.createMaintenanceCost(data);
  }

  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<any[]> {
    return workOrderRepository.getMaintenanceCostsByWorkOrder(workOrderId);
  }

  async getWorkOrderParts(workOrderId: string, orgId: string): Promise<any[]> {
    return workOrderRepository.getWorkOrderParts(workOrderId, orgId);
  }

  async addPartToWorkOrder(data: any): Promise<any> {
    return (workOrderRepository as any).addBulkPartsToWorkOrder(data);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    parts: any[],
    orgId: string
  ): Promise<{ added: any[]; updated: any[]; errors: any[] }> {
    return workOrderRepository.addBulkPartsAndReserveInventory(workOrderId, parts, orgId);
  }

  async updateWorkOrderPart(partId: string, data: any): Promise<any> {
    return workOrderRepository.updateWorkOrderPart(partId, data);
  }

  async removePartAndRestoreInventory(
    workOrderPartId: string,
    orgId: string,
    performedBy: string
  ): Promise<void> {
    return workOrderRepository.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy);
  }

  async getPartsCostForWorkOrder(workOrderId: string): Promise<any> {
    return workOrderRepository.getPartsCostForWorkOrder(workOrderId);
  }

  async getWorkOrderTasks(workOrderId: string, orgId: string): Promise<any[]> {
    return workOrderRepository.getWorkOrderTasks(workOrderId, orgId);
  }

  async createWorkOrderTask(data: any): Promise<any> {
    return workOrderRepository.createWorkOrderTask(data);
  }

  async updateWorkOrderTask(id: string, data: any): Promise<any> {
    return workOrderRepository.updateWorkOrderTask(id, data);
  }

  async deleteWorkOrderTask(id: string): Promise<void> {
    return workOrderRepository.deleteWorkOrderTask(id);
  }

  async getCompletions(filters: any): Promise<any[]> {
    return workOrderRepository.getWorkOrderCompletions(filters);
  }

  async getWorkOrderCompletionAnalytics(filters: any): Promise<any> {
    return workOrderRepository.getWorkOrderCompletionAnalytics(filters);
  }

  async getWorkOrderCompletion(id: string): Promise<any> {
    return workOrderRepository.getWorkOrderCompletion(id);
  }

  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<any[]> {
    return workOrderRepository.getWorkOrderCompletionsByWorkOrder(workOrderId);
  }
}
