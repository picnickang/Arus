export type PredictionOutcome = "confirmed" | "partial" | "false_alarm";

export interface CompletionPredictionFeedback {
  workOrderId: string;
  predictionId?: string | number | null;
  outcome: PredictionOutcome;
  notes?: string;
}

export function mapOutcomeToValidation(outcome: PredictionOutcome): "valid" | "disputed" {
  if (outcome === "false_alarm") return "disputed";
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

export interface WorkOrderCompletionInput {
  workOrderId: string;
  orgId: string;
  completionNotes?: string;
  actualHours?: number;
  predictionFeedback?: CompletionPredictionFeedback;
}

export interface WorkOrderCompletionResult {
  workOrderId: string;
  completed: boolean;
  error?: string;
  savingsCalculated: boolean;
  savingsValidationStatus?: string;
  predictionFeedbackRecorded: boolean;
}
