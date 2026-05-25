export interface WorkOrderCreated {
  type: "WORK_ORDER_CREATED";
  workOrderId: string;
  orgId: string;
  vesselId?: string | undefined;
  equipmentId?: string | undefined;
  priority: string;
  timestamp: Date;
}

export interface WorkOrderUpdated {
  type: "WORK_ORDER_UPDATED";
  workOrderId: string;
  orgId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

export interface WorkOrderStatusChanged {
  type: "WORK_ORDER_STATUS_CHANGED";
  workOrderId: string;
  orgId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string | undefined;
  timestamp: Date;
}

export interface WorkOrderAssigned {
  type: "WORK_ORDER_ASSIGNED";
  workOrderId: string;
  orgId: string;
  assigneeId: string;
  assignedBy?: string | undefined;
  timestamp: Date;
}

export interface WorkOrderCompleted {
  type: "WORK_ORDER_COMPLETED";
  workOrderId: string;
  orgId: string;
  completedBy?: string | undefined;
  actualHours?: number | undefined;
  completionNotes?: string | undefined;
  timestamp: Date;
}

export interface WorkOrderPartAdded {
  type: "WORK_ORDER_PART_ADDED";
  workOrderId: string;
  orgId: string;
  partId: string;
  quantity: number;
  timestamp: Date;
}

export interface WorkOrderTaskCompleted {
  type: "WORK_ORDER_TASK_COMPLETED";
  workOrderId: string;
  orgId: string;
  taskId: string;
  completedBy?: string | undefined;
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
