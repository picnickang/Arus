import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:WorkOrders:Application:WoWorkflowService");
import type {
  IWorkOrderWorkflowRepository,
  ICostSavingsPort,
  IPredictionFeedbackPort,
  ILegacyCompletionPort,
  IWorkOrderEventPort,
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
    private legacyCompletion: ILegacyCompletionPort,
    private events: IWorkOrderEventPort
  ) {}

  async completeWithFeedback(
    input: WorkOrderCompletionInput,
    userId: string
  ): Promise<WorkOrderCompletionResult> {
    const {
      workOrderId,
      orgId,
      predictionFeedback: feedback,
      completionNotes,
      actualHours,
      actualDowntimeHours,
      closeout,
    } = input;

    const wo = await this.woRepo.findById(workOrderId, orgId);
    if (!wo) {
      return {
        workOrderId,
        completed: false,
        error: "Work order not found",
        savingsCalculated: false,
        predictionFeedbackRecorded: false,
      };
    }
    if (wo.status === "completed") {
      return {
        workOrderId,
        completed: false,
        error: "Work order is already completed",
        savingsCalculated: false,
        predictionFeedbackRecorded: false,
      };
    }
    if (wo.status === "cancelled") {
      return {
        workOrderId,
        completed: false,
        error: "Cannot complete a cancelled work order",
        savingsCalculated: false,
        predictionFeedbackRecorded: false,
      };
    }

    const isPredictive = await this.woRepo.isPredictive(workOrderId, orgId);
    if (isPredictive && !feedback) {
      return {
        workOrderId,
        completed: false,
        error: "Prediction feedback is required for predictive work orders",
        savingsCalculated: false,
        predictionFeedbackRecorded: false,
      };
    }

    const closeoutNotes = closeout
      ? [
          closeout.workPerformed ? `Work performed: ${closeout.workPerformed}` : undefined,
          closeout.causeFound ? `Cause found: ${closeout.causeFound}` : undefined,
          closeout.partsUsed ? `Parts used: ${closeout.partsUsed}` : undefined,
          closeout.evidenceNote ? `Evidence: ${closeout.evidenceNote}` : undefined,
          `Checklist verified: ${closeout.checklistVerified ? "yes" : "no"}`,
          `Supervisor verified: ${closeout.supervisorVerified ? "yes" : "no"}`,
        ]
          .filter(Boolean)
          .join("\n")
      : undefined;
    const structuredCompletionNotes = [completionNotes, closeoutNotes].filter(Boolean).join("\n\n") || undefined;
    const laborHours = typeof closeout?.laborHours === "number" ? closeout.laborHours : actualHours;
    const downtimeHours =
      typeof closeout?.downtimeHours === "number"
        ? closeout.downtimeHours
        : typeof actualDowntimeHours === "number"
          ? actualDowntimeHours
          : actualHours || 0;

    try {
      await this.legacyCompletion.completeWorkOrder(
        workOrderId,
        {
          // @ts-ignore -- bulk-silence
          workOrderId,
          orgId,
          equipmentId: wo.equipmentId,
          vesselId: wo.vesselId || undefined,
          completedAt: new Date(),
          completionNotes: structuredCompletionNotes,
          notes: structuredCompletionNotes,
          actualDowntimeHours: downtimeHours,
          actualDurationHours: laborHours,
          partsUsed: closeout?.partsUsed ? [{ description: closeout.partsUsed }] : undefined,
          partsCount: closeout?.partsUsed ? 1 : 0,
          qualityCheckPassed: Boolean(closeout?.checklistVerified && closeout?.supervisorVerified),
          closeout,
        },
        orgId,
        userId
      );
    } catch (err) {
      logger.error(`[WOWorkflow] Legacy completion failed for WO ${workOrderId}:`, undefined, err instanceof Error ? err.message : "unknown");
      return {
        workOrderId,
        completed: false,
        error: "Failed to complete work order",
        savingsCalculated: false,
        predictionFeedbackRecorded: false,
      };
    }

    await this.events.emitStatusChanged(workOrderId, orgId, wo.status, "completed", userId);
    await this.events.emitCompleted(workOrderId, orgId, userId, laborHours, structuredCompletionNotes);

    try {
      await this.legacyCompletion.aggregateProcurementCosts(workOrderId, orgId);
    } catch (err) {
      logger.error(`[WOWorkflow] Procurement cost aggregation failed for WO ${workOrderId}:`, undefined, err instanceof Error ? err.message : "unknown");
    }

    let feedbackRecorded = false;
    if (feedback) {
      try {
        await this.predictionFeedback.recordFeedback(feedback, orgId, userId);
        feedbackRecorded = true;
      } catch (err) {
        logger.error(`[WOWorkflow] Failed to record prediction feedback for WO ${workOrderId}:`, undefined, err instanceof Error ? err.message : "unknown");
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
          userId
        );
        savingsValidationStatus = "disputed";
      } else if (result.saved) {
        savingsValidationStatus = mapOutcomeToValidation(feedback?.outcome ?? "confirmed");
      }
    } catch (err) {
      logger.error(`[WOWorkflow] Savings calculation failed for WO ${workOrderId}:`, undefined, err instanceof Error ? err.message : "unknown");
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
    userId: string
  ): Promise<{ cancelled: boolean; savingsVoided: number; error?: string }> {
    const wo = await this.woRepo.findById(workOrderId, orgId);
    if (!wo) {
      return { cancelled: false, savingsVoided: 0, error: "Work order not found" };
    }
    if (wo.status === "cancelled") {
      return { cancelled: false, savingsVoided: 0, error: "Work order is already cancelled" };
    }
    if (wo.status === "completed") {
      return { cancelled: false, savingsVoided: 0, error: "Cannot cancel a completed work order" };
    }

    const previousStatus = wo.status;
    const updated = await this.woRepo.updateStatus(workOrderId, orgId, "cancelled", userId);
    if (!updated) {
      return { cancelled: false, savingsVoided: 0, error: "Failed to update status" };
    }

    await this.events.emitStatusChanged(workOrderId, orgId, previousStatus, "cancelled", userId);

    const voided = await this.savings.voidForWorkOrder(
      workOrderId,
      orgId,
      `Work order cancelled: ${reason}`,
      userId
    );

    if (voided > 0) {
      logger.info(`[WOWorkflow] Voided ${voided} savings record(s) for cancelled WO ${workOrderId}`);
    }

    return { cancelled: true, savingsVoided: voided };
  }

  async createQuick(orgId: string, input: QuickWorkOrderInput): Promise<QuickWorkOrderResult> {
    return this.woRepo.createQuick(orgId, input);
  }
}
