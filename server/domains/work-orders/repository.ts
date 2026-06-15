import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
  WorkOrderTask,
  InsertWorkOrderTask,
  WorkOrderHistory,
  WorkOrderParts,
  InventoryMovement,
  MaintenanceCost,
  InsertMaintenanceCost,
} from "@shared/schema";
// Push B4: imports go to the canonical homes (`server/db/<domain>` and
// `server/services/domains/*`) directly, not through the legacy
// `server/repositories.ts` service-locator barrel. The work-orders
// domain stays free of that proxy.
import { workOrderService } from "../../services/domains/work-order-service";
import { dbWorkOrderStorage } from "../../db/workorders/index.js";
import { dbChecklistsStorage } from "../../db/checklists/index.js";
import { dbInventoryStorage } from "../../db/inventory/index.js";
import { dbMaintenanceStorage } from "../../db/maintenance/index.js";
import { dbEquipmentStorage } from "../../db/equipment/index.js";
import type { WorkOrderFilters } from "../../services/domains/work-order-service";

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

  async create(
    workOrder: InsertWorkOrder & { woNumber?: string },
    tx?: import("../../lib/event-spine/outbox-repository").TxOrDb
  ): Promise<WorkOrder> {
    // `tx` is intentionally typed as `TxOrDb` (the same handle the
    // outbox repository accepts) so the publisher and the repository
    // operate on a shared transaction; the underlying drizzle
    // PgTransaction satisfies both call sites without any cast.
    return workOrderService.createWorkOrder(
      workOrder,
      tx as Parameters<typeof workOrderService.createWorkOrder>[1]
    );
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

  /**
   * Transactional variant: completes the work order on the caller's
   * `tx` and returns the pending inventory-movement projections so the
   * caller can fire them AFTER the outer transaction commits. Enables
   * the application service to fuse the completion write and the
   * domain-event outbox enqueue into a single atomic commit.
   */
  async completeInTx(
    tx: Parameters<typeof workOrderService.completeWorkOrderInTx>[0],
    workOrderId: string,
    completion: InsertWorkOrderCompletion
  ): Promise<Awaited<ReturnType<typeof workOrderService.completeWorkOrderInTx>>> {
    return workOrderService.completeWorkOrderInTx(tx, workOrderId, completion);
  }

  async getCompletions(filters: {
    equipmentId?: string | undefined;
    vesselId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
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

  async suggestPartsForSensorIssue(_equipmentId: string, _sensorType: string, _orgId: string) {
    return [];
  }

  async getWorkOrderTasks(workOrderId: string, orgId: string): Promise<WorkOrderTask[]> {
    return dbChecklistsStorage.getWorkOrderTasks(workOrderId, orgId);
  }

  async createWorkOrderTask(data: InsertWorkOrderTask): Promise<WorkOrderTask> {
    return dbChecklistsStorage.createWorkOrderTask(data);
  }

  async updateWorkOrderTask(
    id: string,
    data: Partial<InsertWorkOrderTask>
  ): Promise<WorkOrderTask> {
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

  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]> {
    return dbInventoryStorage.getWorkOrderHistory(workOrderId, orgId);
  }

  async getInventoryMovementsByWorkOrder(
    workOrderId: string,
    orgId: string
  ): Promise<InventoryMovement[]> {
    return dbInventoryStorage.getInventoryMovementsByWorkOrder(workOrderId, orgId);
  }

  async createMaintenanceCost(data: InsertMaintenanceCost): Promise<MaintenanceCost> {
    return dbMaintenanceStorage.createMaintenanceCost(data);
  }

  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<MaintenanceCost[]> {
    return dbMaintenanceStorage.getMaintenanceCostsByWorkOrder(workOrderId);
  }

  async getWorkOrderParts(workOrderId: string, orgId: string): Promise<WorkOrderParts[]> {
    return workOrderId
      ? dbWorkOrderStorage.getWorkOrderParts(workOrderId, orgId)
      : Promise.resolve([]);
  }

  async addPartToWorkOrder(
    workOrderId: string,
    partsToAdd: Parameters<typeof dbInventoryStorage.addBulkPartsToWorkOrder>[1],
    orgId: string
  ): Promise<Awaited<ReturnType<typeof dbInventoryStorage.addBulkPartsToWorkOrder>>> {
    return dbInventoryStorage.addBulkPartsToWorkOrder(workOrderId, partsToAdd, orgId);
  }

  async addBulkPartsAndReserveInventory(
    workOrderId: string,
    parts: Parameters<typeof dbInventoryStorage.addBulkPartsAndReserveInventory>[1],
    orgId: string
  ): Promise<Awaited<ReturnType<typeof dbInventoryStorage.addBulkPartsAndReserveInventory>>> {
    return dbInventoryStorage.addBulkPartsAndReserveInventory(workOrderId, parts, orgId);
  }

  async updateWorkOrderPart(
    partId: string,
    data: Parameters<typeof dbWorkOrderStorage.updateWorkOrderPart>[1]
  ): Promise<Awaited<ReturnType<typeof dbWorkOrderStorage.updateWorkOrderPart>>> {
    return dbWorkOrderStorage.updateWorkOrderPart(partId, data);
  }

  async removePartFromWorkOrder(partId: string, orgId?: string): Promise<void> {
    return dbInventoryStorage.removePartFromWorkOrder(partId, orgId);
  }

  async removePartAndRestoreInventory(
    workOrderPartId: string,
    orgId: string,
    performedBy: string
  ): Promise<void> {
    return dbInventoryStorage.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy);
  }

  async getPartsCostForWorkOrder(
    workOrderId: string
  ): Promise<Awaited<ReturnType<typeof dbInventoryStorage.getPartsCostForWorkOrder>>> {
    return dbInventoryStorage.getPartsCostForWorkOrder(workOrderId);
  }

  async getWorkOrderCompletions(filters: {
    equipmentId?: string | undefined;
    vesselId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    orgId: string;
  }): Promise<WorkOrderCompletion[]> {
    return dbWorkOrderStorage.getWorkOrderCompletions(filters);
  }

  async getWorkOrderCompletionAnalytics(filters: {
    equipmentId?: string | undefined;
    vesselId?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    orgId: string;
  }): Promise<Awaited<ReturnType<typeof workOrderService.getWorkOrderCompletionAnalytics>>> {
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
