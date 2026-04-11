import type {
  IWorkOrderWorkflowRepository,
  ICostSavingsPort,
  IPredictionFeedbackPort,
} from "../domain/workflow-ports";
import type {
  WorkOrderCompletionInput,
  WorkOrderCompletionResult,
  QuickWorkOrderInput,
  QuickWorkOrderResult,
} from "../domain/workflow-types";
import { mapOutcomeToValidation } from "../domain/workflow-types";

export class WorkOrderWorkflowService {
  constructor(
    public woRepo: IWorkOrderWorkflowRepository,
    private savings: ICostSavingsPort,
    private predictionFeedback: IPredictionFeedbackPort,
  ) {}

  async completeWithFeedback(
    input: WorkOrderCompletionInput,
    userId: string,
  ): Promise<WorkOrderCompletionResult> {
    const { workOrderId, orgId, predictionFeedback: feedback } = input;

    const updated = await this.woRepo.updateStatus(workOrderId, orgId, "completed", userId);
    if (!updated) {
      return {
        workOrderId,
        completed: false,
        savingsCalculated: false,
        predictionFeedbackRecorded: false,
      };
    }

    let feedbackRecorded = false;
    if (feedback) {
      try {
        await this.predictionFeedback.recordFeedback(feedback, orgId, userId);
        feedbackRecorded = true;
      } catch (err) {
        console.error(
          `[WOWorkflow] Failed to record prediction feedback for WO ${workOrderId}:`,
          err instanceof Error ? err.message : "unknown",
        );
      }
    }

    let savingsCalculated = false;
    let savingsValidationStatus: string | undefined;
    try {
      const result = await this.savings.processCompletion(workOrderId, orgId);
      savingsCalculated = result.saved;

      if (result.saved && feedback?.outcome === "false_alarm") {
        await this.savings.updateValidation(
          workOrderId,
          orgId,
          "disputed",
          "Predicted condition not confirmed during work — flagged as false alarm by completing engineer.",
          userId,
        );
        savingsValidationStatus = "disputed";
      } else if (result.saved) {
        savingsValidationStatus = mapOutcomeToValidation(feedback?.outcome ?? "confirmed");
      }
    } catch (err) {
      console.error(
        `[WOWorkflow] Savings calculation failed for WO ${workOrderId}:`,
        err instanceof Error ? err.message : "unknown",
      );
    }

    return {
      workOrderId,
      completed: true,
      savingsCalculated,
      savingsValidationStatus,
      predictionFeedbackRecorded: feedbackRecorded,
    };
  }

  async cancelWithVoid(
    workOrderId: string,
    orgId: string,
    reason: string,
    userId: string,
  ): Promise<{ cancelled: boolean; savingsVoided: number }> {
    const updated = await this.woRepo.updateStatus(workOrderId, orgId, "cancelled", userId);
    if (!updated) {
      return { cancelled: false, savingsVoided: 0 };
    }

    const voided = await this.savings.voidForWorkOrder(
      workOrderId,
      orgId,
      `Work order cancelled: ${reason}`,
      userId,
    );

    if (voided > 0) {
      console.log(
        `[WOWorkflow] Voided ${voided} savings record(s) for cancelled WO ${workOrderId}`,
      );
    }

    return { cancelled: true, savingsVoided: voided };
  }

  async createQuick(
    orgId: string,
    input: QuickWorkOrderInput,
  ): Promise<QuickWorkOrderResult> {
    return this.woRepo.createQuick(orgId, input);
  }
}
