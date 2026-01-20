/**
 * Work Orders Storage Types
 * Work order management, completions, and checklists
 */

import type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  MaintenanceRecord,
  InsertMaintenanceRecord,
  MaintenanceCost,
  InsertMaintenanceCost,
} from "@shared/schema-runtime";

export interface WorkOrderFilters {
  orgId?: string;
  vesselId?: string;
  equipmentId?: string;
  status?: string;
  priority?: string;
  type?: string;
}

export interface MaintenanceScheduleFilters {
  orgId?: string;
  vesselId?: string;
  equipmentId?: string;
  status?: string;
}

/**
 * Work Orders Storage Interface
 */
export interface IWorkOrderStorage {
  // Work orders CRUD
  getWorkOrders(orgId?: string, filters?: WorkOrderFilters): Promise<WorkOrder[]>;
  getWorkOrder(id: string, orgId?: string): Promise<WorkOrder | undefined>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, workOrder: Partial<InsertWorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;

  // Work order completions
  getWorkOrderCompletions(workOrderId: string): Promise<WorkOrderCompletion[]>;
  createWorkOrderCompletion(completion: InsertWorkOrderCompletion): Promise<WorkOrderCompletion>;
  updateWorkOrderCompletion(id: string, completion: Partial<InsertWorkOrderCompletion>): Promise<WorkOrderCompletion>;
  deleteWorkOrderCompletion(id: string): Promise<void>;

  // Maintenance schedules
  getMaintenanceSchedules(orgId?: string): Promise<MaintenanceSchedule[]>;
  getMaintenanceSchedule(id: string): Promise<MaintenanceSchedule | undefined>;
  createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule(id: string, schedule: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule>;
  deleteMaintenanceSchedule(id: string): Promise<void>;

  // Maintenance records
  getMaintenanceRecords(equipmentId?: string): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord(id: string): Promise<void>;

  // Maintenance costs
  getMaintenanceCosts(workOrderId?: string): Promise<MaintenanceCost[]>;
  createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost>;
  updateMaintenanceCost(id: string, cost: Partial<InsertMaintenanceCost>): Promise<MaintenanceCost>;
  deleteMaintenanceCost(id: string): Promise<void>;
}

// Re-export
export type {
  WorkOrder,
  InsertWorkOrder,
  WorkOrderCompletion,
  InsertWorkOrderCompletion,
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  MaintenanceRecord,
  InsertMaintenanceRecord,
  MaintenanceCost,
  InsertMaintenanceCost,
};
