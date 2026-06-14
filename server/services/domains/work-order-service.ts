/**
 * Work Order Service
 * Encapsulates complex work order business logic while preserving the legacy
 * singleton import path used by repositories, routes, and tests.
 */

import type {
  InsertWorkOrder,
  InsertWorkOrderCompletion,
  WorkOrder,
  WorkOrderCompletion,
  WorkOrderPart,
} from "@shared/schema";
import { db } from "../../db-config";
import { dbWorkOrderStorage } from "../../db/workorders/index.js";
import type { WidenPartial } from "../../lib/widen-partial";
import { cloneWorkOrder as cloneWorkOrderOperation } from "../../db/workorders/operations/clone";
import {
  completeWorkOrder as completeWorkOrderOperation,
  completeWorkOrderInTx as completeWorkOrderInTxOperation,
} from "../../db/workorders/operations/completion";
import {
  closeWorkOrder as closeWorkOrderOperation,
  closeWorkOrderWithInventoryRelease as closeWorkOrderWithInventoryReleaseOperation,
  deleteWorkOrderCascade as deleteWorkOrderCascadeOperation,
  updateWorkOrderWithDowntimeTracking as updateWorkOrderWithDowntimeTrackingOperation,
} from "../../db/workorders/operations/lifecycle";
import {
  getWorkOrderCompletionAnalytics as getWorkOrderCompletionAnalyticsOperation,
  getWorkOrdersPaginated as getWorkOrdersPaginatedOperation,
  getWorkOrdersWithDetails as getWorkOrdersWithDetailsOperation,
} from "../../db/workorders/operations/queries";
import type {
  WorkOrderCloneOptions,
  WorkOrderCloseData,
  WorkOrderCompletionAnalytics,
  WorkOrderCompletionAnalyticsFilters,
  WorkOrderCompletionResult,
  WorkOrderFilters,
  WorkOrderPaginationResult,
  WorkOrderTx,
  WorkOrderWithDetails,
} from "../../db/workorders/operations/types";

export type {
  WorkOrderCloneOptions,
  WorkOrderCloseData,
  WorkOrderCompletionAnalytics,
  WorkOrderCompletionAnalyticsFilters,
  WorkOrderFilters,
  WorkOrderPaginationResult,
  WorkOrderWithDetails,
} from "../../db/workorders/operations/types";

class WorkOrderService {
  async getWorkOrdersWithDetails(
    equipmentId?: string,
    orgId?: string,
    filters?: WorkOrderFilters
  ): Promise<WorkOrderWithDetails[]> {
    return getWorkOrdersWithDetailsOperation(equipmentId, orgId, filters);
  }

  async getWorkOrdersPaginated(
    equipmentId: string | undefined,
    orgId: string | undefined,
    limit: number,
    offset: number,
    filters?: WorkOrderFilters
  ): Promise<WorkOrderPaginationResult> {
    return getWorkOrdersPaginatedOperation(equipmentId, orgId, limit, offset, filters);
  }

  async updateWorkOrderWithDowntimeTracking(
    id: string,
    updates: WidenPartial<InsertWorkOrder>
  ): Promise<WorkOrder> {
    return updateWorkOrderWithDowntimeTrackingOperation(id, updates);
  }

  async closeWorkOrderWithInventoryRelease(
    id: string,
    closeData: WorkOrderCloseData
  ): Promise<WorkOrder> {
    return closeWorkOrderWithInventoryReleaseOperation(id, closeData);
  }

  async generateWorkOrderNumber(orgId: string): Promise<string> {
    return dbWorkOrderStorage.generateWorkOrderNumber(orgId);
  }

  async getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder | undefined> {
    return dbWorkOrderStorage.getWorkOrder(orgId, workOrderId);
  }

  async getWorkOrderById(id: string, orgId: string): Promise<WorkOrder | undefined> {
    return dbWorkOrderStorage.getWorkOrderById(id, orgId);
  }

  async createWorkOrder(
    order: InsertWorkOrder & { woNumber?: string; id?: string },
    tx?: typeof db
  ): Promise<WorkOrder> {
    return dbWorkOrderStorage.createWorkOrder(order, tx);
  }

  async deleteWorkOrder(id: string): Promise<void> {
    return dbWorkOrderStorage.deleteWorkOrder(id);
  }

  async getWorkOrderParts(workOrderId: string): Promise<WorkOrderPart[]> {
    return dbWorkOrderStorage.getWorkOrderParts(workOrderId);
  }

  async getWorkOrderTasks(workOrderId: string) {
    return dbWorkOrderStorage.getWorkOrderTasks(workOrderId);
  }

  async getWorkOrderChecklists(workOrderId: string) {
    return dbWorkOrderStorage.getWorkOrderChecklists(workOrderId);
  }

  async getWorkOrderWorklogs(workOrderId: string) {
    return dbWorkOrderStorage.getWorkOrderWorklogs(workOrderId);
  }

  async closeWorkOrder(id: string, closeData: WorkOrderCloseData): Promise<WorkOrder> {
    return closeWorkOrderOperation(id, closeData);
  }

  async deleteWorkOrderCascade(id: string): Promise<void> {
    return deleteWorkOrderCascadeOperation(id);
  }

  async cloneWorkOrder(
    id: string,
    orgId: string,
    options?: WorkOrderCloneOptions
  ): Promise<WorkOrder> {
    return cloneWorkOrderOperation(id, orgId, (targetOrgId) =>
      this.generateWorkOrderNumber(targetOrgId), options);
  }

  async completeWorkOrderInTx(
    tx: WorkOrderTx,
    workOrderId: string,
    completionData: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletionResult> {
    return completeWorkOrderInTxOperation(tx, workOrderId, completionData);
  }

  async completeWorkOrder(
    workOrderId: string,
    completionData: InsertWorkOrderCompletion
  ): Promise<WorkOrderCompletion> {
    return completeWorkOrderOperation(workOrderId, completionData);
  }

  async getWorkOrderCompletionAnalytics(
    filters?: WorkOrderCompletionAnalyticsFilters
  ): Promise<WorkOrderCompletionAnalytics> {
    return getWorkOrderCompletionAnalyticsOperation(filters);
  }
}

export const workOrderService = new WorkOrderService();
