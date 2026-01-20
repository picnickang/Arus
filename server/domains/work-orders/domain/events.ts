/**
 * Work Orders Domain Events
 * Domain events for work order lifecycle
 */

export interface WorkOrderCreated {
  type: "WORK_ORDER_CREATED";
  workOrderId: string;
  orgId: string;
  vesselId?: string;
  equipmentId?: string;
  priority: string;
  timestamp: Date;
}

export interface WorkOrderUpdated {
  type: "WORK_ORDER_UPDATED";
  workOrderId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

export interface WorkOrderStatusChanged {
  type: "WORK_ORDER_STATUS_CHANGED";
  workOrderId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  timestamp: Date;
}

export interface WorkOrderAssigned {
  type: "WORK_ORDER_ASSIGNED";
  workOrderId: string;
  assigneeId: string;
  assignedBy?: string;
  timestamp: Date;
}

export interface WorkOrderCompleted {
  type: "WORK_ORDER_COMPLETED";
  workOrderId: string;
  completedBy?: string;
  actualHours?: number;
  completionNotes?: string;
  timestamp: Date;
}

export interface WorkOrderPartAdded {
  type: "WORK_ORDER_PART_ADDED";
  workOrderId: string;
  partId: string;
  quantity: number;
  timestamp: Date;
}

export interface WorkOrderTaskCompleted {
  type: "WORK_ORDER_TASK_COMPLETED";
  workOrderId: string;
  taskId: string;
  completedBy?: string;
  timestamp: Date;
}

export type WorkOrderDomainEvent =
  | WorkOrderCreated
  | WorkOrderUpdated
  | WorkOrderStatusChanged
  | WorkOrderAssigned
  | WorkOrderCompleted
  | WorkOrderPartAdded
  | WorkOrderTaskCompleted;
