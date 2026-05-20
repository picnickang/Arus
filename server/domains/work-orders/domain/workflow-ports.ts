import type {
  QuickWorkOrderInput,
  QuickWorkOrderResult,
  CompletionPredictionFeedback,
  WorkOrderCloseoutDetails,
} from "./workflow-types";

export interface IWorkOrderWorkflowRepository {
  createQuick(orgId: string, input: QuickWorkOrderInput): Promise<QuickWorkOrderResult>;
  findById(id: string, orgId: string): Promise<WorkOrderWithWorkflowContext | null>;
  updateStatus(id: string, orgId: string, newStatus: string, updatedBy?: string): Promise<boolean>;
  nextWorkOrderNumber(orgId: string): Promise<string>;
  isPredictive(id: string, orgId: string): Promise<boolean>;
}

export interface WorkOrderWithWorkflowContext {
  id: string;
  workOrderNumber: string;
  equipmentId: string;
  vesselId: string | null;
  status: string;
  maintenanceType: string | null;
  predictionId?: string | number | null;
  costJustification: string | null;
  estimatedRepairCost: number | null;
  estimatedFailureCost: number | null;
  totalCost: number | null;
  totalLaborCost: number | null;
  totalPartsCost: number | null;
}

export interface ICostSavingsPort {
  processCompletion(
    workOrderId: string,
    orgId: string
  ): Promise<{
    saved: boolean;
    savingsId?: string;
  }>;
  voidForWorkOrder(
    workOrderId: string,
    orgId: string,
    reason: string,
    changedBy?: string
  ): Promise<number>;
  updateValidation(
    workOrderId: string,
    orgId: string,
    status: "valid" | "disputed" | "voided",
    reason: string,
    changedBy: string
  ): Promise<boolean>;
}

export interface IPredictionFeedbackPort {
  recordFeedback(
    feedback: CompletionPredictionFeedback,
    orgId: string,
    userId: string
  ): Promise<void>;
}

export interface LegacyCompletionData {
  equipmentId?: string;
  vesselId?: string | null;
  completedAt?: Date;
  completedBy?: string | null;
  actualDowntimeHours?: number;
  completionNotes?: string | null;
  notes?: string | null;
  partsUsed?: unknown;
  partsCount?: number;
  qualityCheckPassed?: boolean;
  actualDurationHours?: number;
  closeout?: WorkOrderCloseoutDetails;
}

export interface ILegacyCompletionPort {
  completeWorkOrder(
    workOrderId: string,
    completionData: LegacyCompletionData,
    orgId: string,
    userId?: string
  ): Promise<void>;
  aggregateProcurementCosts(workOrderId: string, orgId: string): Promise<void>;
}

export interface FailureHistoryRecordInput {
  workOrderId: string;
  orgId: string;
  equipmentId: string;
  /** Free-text cause from closeout — used as the canonical failureMode label. */
  cause: string;
  /** Optional severity hint; defaults to "medium" if not supplied. */
  severity?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt?: Date;
}

export interface IFailureHistoryPort {
  /**
   * Insert a failure_history row for a completed work order whose closeout
   * carried a cause, then fire `projectFailureHistory` post-commit so the
   * knowledge graph stays in sync. Best-effort: must never throw.
   */
  recordFailure(input: FailureHistoryRecordInput): Promise<void>;
}

export interface IWorkOrderEventPort {
  emitCompleted(
    workOrderId: string,
    orgId: string,
    completedBy: string,
    actualHours?: number,
    completionNotes?: string
  ): Promise<void>;
  emitStatusChanged(
    workOrderId: string,
    orgId: string,
    previousStatus: string,
    newStatus: string,
    changedBy?: string
  ): Promise<void>;
}
