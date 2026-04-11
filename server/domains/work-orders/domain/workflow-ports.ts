import type {
  QuickWorkOrderInput,
  QuickWorkOrderResult,
  CompletionPredictionFeedback,
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
  processCompletion(workOrderId: string, orgId: string): Promise<{
    saved: boolean;
    savingsId?: string;
  }>;
  voidForWorkOrder(workOrderId: string, orgId: string, reason: string, changedBy?: string): Promise<number>;
  updateValidation(
    workOrderId: string,
    orgId: string,
    status: "valid" | "disputed" | "voided",
    reason: string,
    changedBy: string,
  ): Promise<boolean>;
}

export interface IPredictionFeedbackPort {
  recordFeedback(feedback: CompletionPredictionFeedback, orgId: string, userId: string): Promise<void>;
}
