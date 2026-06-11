import type { AttentionWorkflowService } from "../../application/attention-service.js";
import type { OperatorExperienceSignalsPort } from "../domain/ports.js";
import type { OperatorExperienceSignalSnapshot } from "../domain/types.js";

type WorkflowItemLike = {
  type?: string;
  queue?: string;
  severity?: string;
};

export class AttentionWorkflowSignalsAdapter implements OperatorExperienceSignalsPort {
  constructor(private readonly attentionService: AttentionWorkflowService) {}

  async getSnapshot(orgId: string): Promise<OperatorExperienceSignalSnapshot> {
    const workflow = await this.attentionService.getWorkflow(orgId);
    const items = workflow.items as WorkflowItemLike[];
    const criticalItems = items.filter((item) => item.severity === "critical").length;
    const pdmRisks = items.filter(
      (item) => item.type === "equipment" || item.queue === "needs_review"
    ).length;
    const sourceHealth = {
      workOrders: workflow.sources.workOrders,
      alerts: workflow.sources.alerts,
      equipment: workflow.sources.equipment,
      inventory: workflow.sources.inventory,
    };
    const dataQualityWarnings = Object.values(sourceHealth).filter(
      (status) => status !== "ok"
    ).length;

    return {
      attentionItems: workflow.items.length,
      criticalItems,
      blockedItems: workflow.handover.blockedJobs,
      waitingOnParts: workflow.handover.waitingOnParts,
      readyForCloseout: workflow.handover.readyForCloseout,
      handoverNotes: workflow.handover.suggestedSummary.length,
      offlinePending: 0,
      conflicts: 0,
      pdmRisks,
      dataQualityWarnings,
      lastSyncAt: null,
      sourceHealth,
    };
  }
}
