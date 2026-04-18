import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
  WorkOrderTask,
  InsertWorkOrderTask,
} from "@shared/schema-runtime";
import { workOrderService, dbWorkOrderStorage, dbChecklistsStorage, dbInventoryStorage, dbMaintenanceStorage, dbEquipmentStorage } from "../../repositories";
import type { WorkOrderFilters } from "../../db/workorders/types";

export class WorkOrderRepository {
  async findAll(
    equipmentId?: string,
    orgId?: string,
    filters?: WorkOrderFilters
  ): Promise<WorkOrder[]> {
    return workOrderService.getWorkOrdersWithDetails(equipmentId, orgId, filters);
  }

  async findPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: WorkOrderFilters
  ): Promise<{ items: WorkOrder[]; total: number }> {
    return workOrderService.getWorkOrdersPaginated(equipmentId, orgId, limit, offset, filters);
  }

  async findById(id: string, orgId: string): Promise<WorkOrder | undefined> {
    return workOrderService.getWorkOrderById(id, orgId);
  }

  async create(workOrder: InsertWorkOrder & { woNumber?: string }): Promise<WorkOrder> {
    return workOrderService.createWorkOrder(workOrder);
  }

  async update(id: string, data: Partial<InsertWorkOrder>): Promise<WorkOrder> {
    return workOrderService.updateWorkOrderWithDowntimeTracking(id, data);
  }

  async delete(id: string): Promise<void> {
    return workOrderService.deleteWorkOrderCascade(id);
  }

  async generateWorkOrderNumber(orgId: string): Promise<string> {
    return workOrderService.generateWorkOrderNumber(orgId);
  }

  async complete(
    workOrderId: string,
    completion: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    return workOrderService.completeWorkOrder(workOrderId, completion);
  }

  async getCompletions(filters: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId: string;
  }): Promise<WorkOrderCompletion[]> {
    return dbWorkOrderStorage.getWorkOrderCompletions(filters);
  }

  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> {
    return dbInventoryStorage.releasePartsFromWorkOrder(workOrderId, orgId);
  }

  async getEquipmentWithSensorIssues(orgId: string) {
    return dbEquipmentStorage.getEquipmentWithSensorIssues(orgId);
  }

  async suggestPartsForSensorIssue(equipmentId: string, sensorType: string, orgId: string) {
    return [];
  }

  async getWorkOrderTasks(workOrderId: string, orgId: string): Promise<WorkOrderTask[]> {
    return dbChecklistsStorage.getWorkOrderTasks(workOrderId, orgId);
  }

  async createWorkOrderTask(data: InsertWorkOrderTask): Promise<WorkOrderTask> {
    return dbChecklistsStorage.createWorkOrderTask(data);
  }

  async updateWorkOrderTask(id: string, data: Partial<InsertWorkOrderTask>): Promise<WorkOrderTask> {
    return dbChecklistsStorage.updateWorkOrderTask(id, data);
  }

  async deleteWorkOrderTask(id: string): Promise<void> {
    return dbChecklistsStorage.deleteWorkOrderTask(id);
  }

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
    return workOrderService.cloneWorkOrder(workOrderId, orgId, options);
  }

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<any[]> {
    return dbInventoryStorage.getWorkOrderHistory(workOrderId, orgId);
  }

  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<any[]> {
    return dbInventoryStorage.getInventoryMovementsByWorkOrder(workOrderId, orgId);
  }

  async createMaintenanceCost(data: any): Promise<any> {
    return dbMaintenanceStorage.createMaintenanceCost(data);
  }

  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<any[]> {
    return dbMaintenanceStorage.getMaintenanceCostsByWorkOrder(workOrderId);
  }

  async getWorkOrderParts(workOrderId: string, orgId: string): Promise<any[]> {
    return workOrderId ? dbWorkOrderStorage.getWorkOrderParts(workOrderId, orgId) : Promise.resolve([]);
  }

  async addPartToWorkOrder(data: any): Promise<any> {
    return dbInventoryStorage.addBulkPartsToWorkOrder(data);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    parts: any[],
    orgId: string
  ): Promise<{ added: any[]; updated: any[]; errors: any[] }> {
    return dbInventoryStorage.addBulkPartsAndReserveInventory(workOrderId, parts, orgId);
  }

  async updateWorkOrderPart(partId: string, data: any): Promise<any> {
    return dbInventoryStorage.updateWorkOrderPart(partId, data);
  }

  async removePartFromWorkOrder(partId: string, orgId?: string): Promise<void> {
    return dbInventoryStorage.removePartFromWorkOrder(partId, orgId);
  }

  async removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void> {
    return dbInventoryStorage.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy);
  }

  async getPartsCostForWorkOrder(workOrderId: string): Promise<any> {
    return dbInventoryStorage.getPartsCostForWorkOrder(workOrderId);
  }

  async getWorkOrderCompletions(filters: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId: string;
  }): Promise<WorkOrderCompletion[]> {
    return dbWorkOrderStorage.getWorkOrderCompletions(filters);
  }

  async getWorkOrderCompletionAnalytics(filters: {
    equipmentId?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    orgId: string;
  }): Promise<any> {
    return workOrderService.getWorkOrderCompletionAnalytics(filters);
  }

  async getWorkOrderCompletion(id: string): Promise<WorkOrderCompletion | undefined> {
    return dbWorkOrderStorage.getWorkOrderCompletion(id);
  }

  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<WorkOrderCompletion[]> {
    return dbWorkOrderStorage.getWorkOrderCompletionsByWorkOrder(workOrderId);
  }
}

export const workOrderRepository = new WorkOrderRepository();
