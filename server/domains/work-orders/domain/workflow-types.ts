export type PredictionOutcome = "confirmed" | "partial" | "false_alarm";

export interface CompletionPredictionFeedback {
  workOrderId: string;
  predictionId?: string | number | null | undefined;
  outcome: PredictionOutcome;
  notes?: string | undefined;
}

export function mapOutcomeToValidation(outcome: PredictionOutcome): "valid" | "disputed" {
  if (outcome === "false_alarm") {
    return "disputed";
  }
  return "valid";
}

export interface QuickWorkOrderInput {
  equipmentId: string;
  description: string;
  priority: "low" | "medium" | "high";
  photoBase64?: string;
  vesselId?: string;
}

export interface QuickWorkOrderResult {
  id: string;
  workOrderNumber: string;
  status: "open";
  createdVia: "quick_mobile";
  queuedOffline: boolean;
}

export interface WorkOrderCloseoutDetails {
  workPerformed?: string | undefined;
  causeFound?: string | undefined;
  partsUsed?: string | undefined;
  laborHours?: number | null | undefined;
  downtimeHours?: number | null | undefined;
  evidenceNote?: string | undefined;
  checklistVerified?: boolean | undefined;
  supervisorVerified?: boolean | undefined;
}

export interface WorkflowWorkOrderCompletionInput {
  workOrderId: string;
  orgId: string;
  completionNotes?: string | undefined;
  actualHours?: number | undefined;
  actualDowntimeHours?: number | undefined;
  closeout?: WorkOrderCloseoutDetails | undefined;
  predictionFeedback?: CompletionPredictionFeedback | undefined;
}

export interface WorkflowWorkOrderCompletionResult {
  workOrderId: string;
  completed: boolean;
  error?: string | undefined;
  savingsCalculated: boolean;
  savingsValidationStatus?: string | undefined;
  predictionFeedbackRecorded: boolean;
}
