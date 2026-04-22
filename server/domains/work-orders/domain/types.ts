/**
 * Work Orders Domain - Core Types
 * Pure domain models with no external dependencies
 */

import type {
  WorkOrder as SelectWorkOrder,
  InsertWorkOrder,
  WorkOrderPart as SelectWorkOrderPart,
  InsertWorkOrderParts as InsertWorkOrderPart,
  WorkOrderTask as SelectWorkOrderTask,
  InsertWorkOrderTask,
} from "@shared/schema";

export type {
  SelectWorkOrder,
  InsertWorkOrder,
  SelectWorkOrderPart,
  InsertWorkOrderPart,
  SelectWorkOrderTask,
  InsertWorkOrderTask,
};

export type WorkOrder = SelectWorkOrder;
export type WorkOrderPart = SelectWorkOrderPart;
export type WorkOrderTask = SelectWorkOrderTask;

export type WorkOrderStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type WorkOrderPriority = "low" | "medium" | "high" | "critical";

export interface WorkOrderWithDetails extends WorkOrder {
  parts?: WorkOrderPart[];
  tasks?: WorkOrderTask[];
  equipment?: {
    id: string;
    name: string;
    location?: string;
  };
  assignee?: {
    id: string;
    name: string;
  };
}

export interface WorkOrderSearchCriteria {
  orgId?: string;
  vesselId?: string;
  equipmentId?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assigneeId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
}

export interface WorkOrderCostSummary {
  workOrderId: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  estimatedVsActual?: number;
}
