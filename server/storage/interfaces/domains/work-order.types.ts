/**
 * Work Order Storage Interface - Work Orders, Tasks, Checklists, History
 * Part of IStorage modularization for improved maintainability
 */

import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
  WorkOrderChecklist,
  InsertWorkOrderChecklist,
  WorkOrderWorklog,
  InsertWorkOrderWorklog,
  WorkOrderTask,
  InsertWorkOrderTask,
  WorkOrderParts,
  InsertWorkOrderParts,
  WorkOrderHistory,
  InsertWorkOrderHistory,
  InventoryMovement,
} from "@shared/schema";

export interface WorkOrderFilters {
  vesselId?: string;
  assignedCrewId?: string;
  status?: string;
  priority?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  equipmentCategory?: string;
  search?: string;
  workOrderType?: string; // routine, defect, service_request, certificate_renewal
}

/**
 * Work order storage operations for orders, tasks, checklists, and history
 */
export interface IWorkOrderStorage {
  // Work Orders
  getWorkOrders(equipmentId?: string, orgId?: string, filters?: WorkOrderFilters): Promise<WorkOrder[]>;
  getWorkOrdersPaginated(equipmentId: string | undefined, orgId: string | undefined, limit: number, offset: number, filters?: WorkOrderFilters): Promise<{ items: WorkOrder[]; total: number }>;
  getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder | undefined>;
  getWorkOrderById(id: string, orgId: string): Promise<WorkOrder | undefined>;
  generateWorkOrderNumber(orgId: string): Promise<string>;
  createWorkOrder(order: InsertWorkOrder & { woNumber?: string }): Promise<WorkOrder>;
  updateWorkOrder(id: string, order: Partial<InsertWorkOrder>): Promise<WorkOrder>;
  closeWorkOrder(id: string, closeData: { notes?: string; completedBy?: string }): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;
  cloneWorkOrder(id: string, orgId: string, options?: { plannedStartDate?: Date; plannedEndDate?: Date; includeTasks?: boolean; includeParts?: boolean }): Promise<WorkOrder>;
  clearAllWorkOrders(): Promise<void>;
  getWorkOrderHistory(equipmentId: string, days?: number, orgId?: string): Promise<WorkOrder[]>;

  // Work Order Completions
  createWorkOrderCompletion(completion: InsertWorkOrderCompletion): Promise<WorkOrderCompletion>;
  getWorkOrderCompletions(filters?: { equipmentId?: string; vesselId?: string; startDate?: Date; endDate?: Date; orgId?: string }): Promise<WorkOrderCompletion[]>;
  getWorkOrderCompletion(id: string): Promise<WorkOrderCompletion | undefined>;
  getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<WorkOrderCompletion[]>;
  completeWorkOrder(workOrderId: string, completionData: InsertWorkOrderCompletion): Promise<WorkOrderCompletion>;
  getWorkOrderCompletionAnalytics(filters?: { equipmentId?: string; vesselId?: string; startDate?: Date; endDate?: Date; orgId?: string }): Promise<{ totalCompletions: number; avgDurationVariance: number; avgCostVariance: number; onTimeCompletionRate: number; totalDowntimeHours: number }>;

  // Work Order Checklists
  getWorkOrderChecklists(workOrderId?: string, orgId?: string): Promise<WorkOrderChecklist[]>;
  createWorkOrderChecklist(checklist: InsertWorkOrderChecklist): Promise<WorkOrderChecklist>;
  updateWorkOrderChecklist(id: string, checklist: Partial<InsertWorkOrderChecklist>): Promise<WorkOrderChecklist>;
  deleteWorkOrderChecklist(id: string): Promise<void>;

  // Work Order Worklogs
  getWorkOrderWorklogs(workOrderId?: string, orgId?: string): Promise<WorkOrderWorklog[]>;
  createWorkOrderWorklog(worklog: InsertWorkOrderWorklog): Promise<WorkOrderWorklog>;
  updateWorkOrderWorklog(id: string, worklog: Partial<InsertWorkOrderWorklog>): Promise<WorkOrderWorklog>;
  deleteWorkOrderWorklog(id: string): Promise<void>;
  calculateWorklogCosts(workOrderId: string): Promise<{ totalLaborHours: number; totalLaborCost: number }>;

  // Work Order Tasks
  getWorkOrderTasks(workOrderId: string, orgId?: string): Promise<WorkOrderTask[]>;
  createWorkOrderTask(task: InsertWorkOrderTask): Promise<WorkOrderTask>;
  updateWorkOrderTask(id: string, task: Partial<InsertWorkOrderTask>): Promise<WorkOrderTask>;
  deleteWorkOrderTask(id: string): Promise<void>;

  // Work Order Parts
  getWorkOrderParts(workOrderId?: string, orgId?: string): Promise<WorkOrderParts[]>;
  addPartToWorkOrder(workOrderPart: InsertWorkOrderParts): Promise<WorkOrderParts>;
  addPartToWorkOrderWithValidation(workOrderId: string, partId: string, quantity: number, usedBy: string, orgId: string): Promise<WorkOrderParts>;
  updateWorkOrderPart(id: string, workOrderPart: Partial<InsertWorkOrderParts>): Promise<WorkOrderParts>;
  removePartFromWorkOrder(id: string, orgId?: string): Promise<void>;
  removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void>;
  getPartsCostForWorkOrder(workOrderId: string): Promise<{ totalPartsCost: number; partsCount: number }>;
  checkPartAvailabilityForWorkOrder(partId: string, quantity: number, orgId?: string): Promise<{ available: boolean; onHand: number; reserved: number }>;
  reservePartsForWorkOrder(workOrderId: string): Promise<void>;
  releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void>;
  addBulkPartsToWorkOrder(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }>;
  addBulkPartsAndReserveInventory(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }>;
  getWorkOrderPartsByEquipment(orgId: string, equipmentId: string): Promise<WorkOrderParts[]>;
  getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<WorkOrderParts[]>;

  // Work Order History
  getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]>;
  addWorkOrderHistoryEntry(entry: InsertWorkOrderHistory): Promise<WorkOrderHistory>;
  getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<InventoryMovement[]>;

  // Cost Calculations
  calculateWorkOrderTotalCost(workOrderId: string, orgId?: string): Promise<{ totalPartsCost: number; totalLaborCost: number; downtimeCost: number; totalCost: number; roi?: number }>;
  updateWorkOrderCosts(workOrderId: string, orgId?: string): Promise<WorkOrder>;
}
