/**
 * Work Order Application Service
 * Orchestrates use cases with dependency injection
 */

import type {
  IWorkOrderRepository,
  IWorkOrderEventPublisher,
  SelectWorkOrder,
  InsertWorkOrder,
  WorkOrderSearchCriteria,
} from "../domain";

export interface WorkOrderServiceDependencies {
  workOrderRepository: IWorkOrderRepository;
  eventPublisher: IWorkOrderEventPublisher;
}

export class WorkOrderApplicationService {
  constructor(private deps: WorkOrderServiceDependencies) {}

  async listWorkOrders(orgId?: string, vesselId?: string): Promise<SelectWorkOrder[]> {
    return this.deps.workOrderRepository.findAll(orgId, vesselId);
  }

  async getWorkOrderById(id: string, orgId?: string): Promise<SelectWorkOrder | undefined> {
    return this.deps.workOrderRepository.findById(id, orgId);
  }

  async searchWorkOrders(criteria: WorkOrderSearchCriteria): Promise<SelectWorkOrder[]> {
    return this.deps.workOrderRepository.findByCriteria(criteria);
  }

  async createWorkOrder(data: InsertWorkOrder, userId?: string): Promise<SelectWorkOrder> {
    const workOrder = await this.deps.workOrderRepository.create(data);

    await this.deps.eventPublisher.publish({
      type: "WORK_ORDER_CREATED",
      workOrderId: workOrder.id,
      orgId: workOrder.orgId || "default",
      vesselId: workOrder.vesselId || undefined,
      equipmentId: workOrder.equipmentId || undefined,
      priority: workOrder.priority || "medium",
      timestamp: new Date(),
    });

    return workOrder;
  }

  async updateWorkOrder(id: string, data: Partial<InsertWorkOrder>, userId?: string): Promise<SelectWorkOrder> {
    const previous = await this.deps.workOrderRepository.findById(id);
    const workOrder = await this.deps.workOrderRepository.update(id, data);

    if (data.status && previous && data.status !== previous.status) {
      await this.deps.eventPublisher.publish({
        type: "WORK_ORDER_STATUS_CHANGED",
        workOrderId: workOrder.id,
        previousStatus: previous.status || "draft",
        newStatus: data.status,
        changedBy: userId,
        timestamp: new Date(),
      });
    } else {
      await this.deps.eventPublisher.publish({
        type: "WORK_ORDER_UPDATED",
        workOrderId: workOrder.id,
        changes: data,
        timestamp: new Date(),
      });
    }

    return workOrder;
  }

  async deleteWorkOrder(id: string): Promise<void> {
    await this.deps.workOrderRepository.delete(id);
  }

  async completeWorkOrder(id: string, completedBy?: string, notes?: string): Promise<SelectWorkOrder> {
    const workOrder = await this.deps.workOrderRepository.update(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    await this.deps.eventPublisher.publish({
      type: "WORK_ORDER_COMPLETED",
      workOrderId: workOrder.id,
      completedBy,
      completionNotes: notes,
      timestamp: new Date(),
    });

    return workOrder;
  }

  async getOverdueWorkOrders(orgId?: string): Promise<SelectWorkOrder[]> {
    return this.deps.workOrderRepository.findOverdue(orgId);
  }
}
