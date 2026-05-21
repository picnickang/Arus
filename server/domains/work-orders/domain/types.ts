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

// Re-export canonical names. Using `export { type X as Y }` so the
// duplicate-types guard (which counts `export type X = …` declarations)
// does not see these as new definitions — the canonical sources remain
// shared/schema/work-orders.ts.
export type {
  SelectWorkOrder as WorkOrder,
  SelectWorkOrderPart as WorkOrderPart,
  SelectWorkOrderTask as WorkOrderTask,
};

export type WorkOrderStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type WorkOrderPriority = "low" | "medium" | "high" | "critical";

export interface WorkOrderWithDetails extends SelectWorkOrder {
  parts?: SelectWorkOrderPart[];
  tasks?: SelectWorkOrderTask[];
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
