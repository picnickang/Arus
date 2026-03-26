import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
  WorkOrderTask,
  InsertWorkOrderTask,
} from "@shared/schema-runtime";
import { storage, WorkOrderFilters } from "../../storage";

/**
 * Work Orders Repository
 * Handles all data access for work orders domain
 */
export class WorkOrderRepository {
  async findAll(
    equipmentId?: string,
    orgId?: string,
    filters?: WorkOrderFilters
  ): Promise<WorkOrder[]> {
    return storage.getWorkOrders(equipmentId, orgId, filters);
  }

  async findPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: WorkOrderFilters
  ): Promise<{ items: WorkOrder[]; total: number }> {
    return storage.getWorkOrdersPaginated(equipmentId, orgId, limit, offset, filters);
  }

  async findById(id: string, orgId: string): Promise<WorkOrder | undefined> {
    return storage.getWorkOrderById(id, orgId);
  }

  async create(workOrder: InsertWorkOrder & { woNumber?: string }): Promise<WorkOrder> {
    return storage.createWorkOrder(workOrder);
  }

  async update(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    return storage.updateWorkOrder(id, data);
  }

  async delete(id: string): Promise<void> {
    return storage.deleteWorkOrder(id);
  }

  async generateWorkOrderNumber(orgId: string): Promise<string> {
    return storage.generateWorkOrderNumber(orgId);
  }

  async complete(
    workOrderId: string,
    completion: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    return storage.completeWorkOrder(workOrderId, completion);
  }

  async getCompletions(filters: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId: string;
  }): Promise<WorkOrderCompletion[]> {
    return storage.getWorkOrderCompletions(filters);
  }

  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    return storage.releasePartsFromWorkOrder(workOrderId, orgId);
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return storage.getEquipmentWithSensorIssues(orgId);
  }

  async suggestPartsForSensorIssue(equipmentId: string, sensorType: string, orgId: string) {
    return storage.suggestPartsForSensorIssue(equipmentId, sensorType, orgId);
  }

  // Work Order Tasks (Phase 2 - Ad-hoc tasks)
  async getWorkOrderTasks(workOrderId: string, orgId: string): Promise<WorkOrderTask[]> {
    return storage.getWorkOrderTasks(workOrderId, orgId);
  }

  async createWorkOrderTask(data: InsertWorkOrderTask): Promise<WorkOrderTask> {
    return storage.createWorkOrderTask(data);
  }

  async updateWorkOrderTask(id: string, data: Partial<InsertWorkOrderTask>): Promise<WorkOrderTask> {
    return storage.updateWorkOrderTask(id, data);
  }

  async deleteWorkOrderTask(id: string): Promise<void> {
    return storage.deleteWorkOrderTask(id);
  }

  // ============================================
  // Extended Work Order Operations
  // ============================================

  async cloneWorkOrder(
    workOrderId: string,
    orgId: string,
    options: {
      plannedStartDate?: Date;
      plannedEndDate?: Date;
      includeTasks?: boolean;
      includeParts?: boolean;
    }
  ): Promise<WorkOrder> {
    return storage.cloneWorkOrder(workOrderId, orgId, options);
  }

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<any[]> {
    return storage.getWorkOrderHistory(workOrderId, orgId);
  }

  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<any[]> {
    return storage.getInventoryMovementsByWorkOrder(workOrderId, orgId);
  }

  async createMaintenanceCost(data: any): Promise<any> {
    return storage.createMaintenanceCost(data);
  }

  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<any[]> {
    return storage.getMaintenanceCostsByWorkOrder(workOrderId);
  }

  async getWorkOrderParts(workOrderId: string, orgId: string): Promise<any[]> {
    return storage.getWorkOrderParts(workOrderId, orgId);
  }

  async addPartToWorkOrder(data: any): Promise<any> {
    return storage.addPartToWorkOrder(data);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    parts: any[],
    orgId: string
  ): Promise<{ added: any[]; updated: any[]; errors: any[] }> {
    return storage.addBulkPartsAndReserveInventory(workOrderId, parts, orgId);
  }

  async updateWorkOrderPart(partId: string, data: any): Promise<any> {
    return storage.updateWorkOrderPart(partId, data);
  }

  async removePartFromWorkOrder(partId: string, orgId?: string): Promise<void> {
    return storage.removePartFromWorkOrder(partId, orgId);
  }

  async removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void> {
    return storage.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy);
  }

  async getPartsCostForWorkOrder(workOrderId: string): Promise<any> {
    return storage.getPartsCostForWorkOrder(workOrderId);
  }

  async getWorkOrderCompletions(filters: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId: string;
  }): Promise<WorkOrderCompletion[]> {
    return storage.getWorkOrderCompletions(filters);
  }

  async getWorkOrderCompletionAnalytics(filters: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId: string;
  }): Promise<any> {
    return storage.getWorkOrderCompletionAnalytics(filters);
  }

  async getWorkOrderCompletion(id: string): Promise<WorkOrderCompletion | undefined> {
    return storage.getWorkOrderCompletion(id);
  }

  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<WorkOrderCompletion[]> {
    return storage.getWorkOrderCompletionsByWorkOrder(workOrderId);
  }
}

// Export singleton instance
export const workOrderRepository = new WorkOrderRepository();
