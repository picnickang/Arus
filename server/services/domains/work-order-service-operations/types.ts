import type {
  InsertWorkOrderCompletion,
  WorkOrder,
  WorkOrderCompletion,
} from "@shared/schema";
import type { db } from "../../../db-config";
import type { PendingMovementProjection } from "../../../db/inventory/index.js";

export interface WorkOrderFilters {
  vesselId?: string;
  assignedCrewId?: string;
  status?: string;
  priority?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  equipmentCategory?: string;
  search?: string;
  workOrderType?: string;
}

export interface WorkOrderWithDetails extends WorkOrder {
  equipmentName?: string | null;
  equipmentType?: string | null;
  vesselName?: string | null;
}

export interface WorkOrderPaginationResult {
  items: WorkOrderWithDetails[];
  total: number;
}

export interface WorkOrderCloneOptions {
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  includeTasks?: boolean;
  includeParts?: boolean;
}

export interface WorkOrderCloseData {
  notes?: string;
  completedBy?: string;
}

export interface WorkOrderCompletionAnalyticsFilters {
  equipmentId?: string | undefined;
  vesselId?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  orgId?: string | undefined;
}

export interface WorkOrderCompletionAnalytics {
  totalCompletions: number;
  avgDurationVariance: number;
  avgCostVariance: number;
  onTimeCompletionRate: number;
  totalDowntimeHours: number;
}

export type WorkOrderTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The injected database handle. The split work-order operations receive this
 * from the parent `work-order-service.ts` (the single owner of the db import)
 * rather than importing the singleton themselves, keeping db access out of the
 * service layer per the hexagonal storage boundary.
 */
export type WorkOrderDb = typeof db;

export interface WorkOrderCompletionResult {
  completion: WorkOrderCompletion;
  pendingProjections: PendingMovementProjection[];
}

export type WorkOrderCompletionInput = InsertWorkOrderCompletion & {
  downtimeCostPerHour?: number | null;
  totalCost?: number | null;
};
