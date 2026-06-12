import { randomUUID } from "node:crypto";
import type { AttentionWorkflowSources } from "../domain/ports.js";
import { cleanString, issueHref, latestBy } from "./attention-helpers.js";
import { readWorkflowState, writeWorkflowState } from "./attention-state.js";
import type {
  AttentionWorkflowResponse,
  BlockerResolutionRecord,
  HandoverRecord,
  IssueReportRecord,
} from "./attention-types.js";
import { buildAttentionWorkflow } from "./attention-workflow-builder.js";

export class AttentionWorkflowService {
  constructor(private readonly sources: AttentionWorkflowSources) {}

  async getWorkflow(orgId: string): Promise<AttentionWorkflowResponse> {
    return buildAttentionWorkflow(this.sources, orgId);
  }

  async getLatestHandover(orgId: string): Promise<HandoverRecord | null> {
    const state = await readWorkflowState();
    return (
      latestBy(
        state.handovers.filter((record) => record.orgId === orgId),
        (record) => record.savedAt
      )[0] ?? null
    );
  }

  async listHandovers(orgId: string, limit = 20): Promise<HandoverRecord[]> {
    const state = await readWorkflowState();
    return latestBy(
      state.handovers.filter((record) => record.orgId === orgId),
      (record) => record.savedAt
    ).slice(0, limit);
  }

  async saveHandover(
    orgId: string,
    input: {
      note: unknown;
      watchLabel?: unknown;
      generatedSummary?: unknown;
      itemIds?: unknown;
      status?: unknown;
    },
    authorId?: string
  ): Promise<HandoverRecord> {
    const state = await readWorkflowState();
    const record: HandoverRecord = {
      id: randomUUID(),
      orgId,
      note: cleanString(input.note),
      watchLabel: cleanString(input.watchLabel) || undefined,
      generatedSummary: cleanString(input.generatedSummary),
      itemIds: Array.isArray(input.itemIds)
        ? input.itemIds.map((item) => String(item)).slice(0, 50)
        : [],
      authorId,
      status: input.status === "shared" || input.status === "acknowledged" ? input.status : "draft",
      savedAt: new Date().toISOString(),
    };
    state.handovers = [record, ...state.handovers].slice(0, 200);
    await writeWorkflowState(state);
    return record;
  }

  async saveBlockerResolution(
    orgId: string,
    input: {
      itemId?: unknown;
      workOrderId?: unknown;
      inventoryItemId?: unknown;
      blockerType?: unknown;
      reason?: unknown;
      owner?: unknown;
      eta?: unknown;
      status?: unknown;
      note?: unknown;
    },
    authorId?: string
  ): Promise<BlockerResolutionRecord> {
    const status = ["updated", "waiting", "unblocked", "deferred"].includes(String(input.status))
      ? (String(input.status) as BlockerResolutionRecord["status"])
      : "updated";
    const state = await readWorkflowState();
    const record: BlockerResolutionRecord = {
      id: randomUUID(),
      orgId,
      itemId: cleanString(
        input.itemId,
        cleanString(input.workOrderId, cleanString(input.inventoryItemId, "unknown"))
      ),
      workOrderId: cleanString(input.workOrderId) || undefined,
      inventoryItemId: cleanString(input.inventoryItemId) || undefined,
      blockerType: cleanString(input.blockerType, "Information needed"),
      reason: cleanString(input.reason, "No reason provided"),
      owner: cleanString(input.owner) || undefined,
      eta: cleanString(input.eta) || undefined,
      status,
      note: cleanString(input.note) || undefined,
      savedAt: new Date().toISOString(),
      authorId,
    };
    state.blockerResolutions = [record, ...state.blockerResolutions].slice(0, 500);
    await writeWorkflowState(state);
    return record;
  }

  async reportIssue(
    orgId: string,
    input: {
      severity?: unknown;
      summary?: unknown;
      vessel?: unknown;
      equipment?: unknown;
      location?: unknown;
      impact?: unknown;
      evidenceNote?: unknown;
      owner?: unknown;
      dueDate?: unknown;
      target?: unknown;
      status?: unknown;
    },
    authorId?: string
  ): Promise<IssueReportRecord> {
    const severity = ["critical", "high", "medium", "low"].includes(String(input.severity))
      ? (String(input.severity) as IssueReportRecord["severity"])
      : "medium";
    const target = ["work_order", "finding", "log_note", "handover"].includes(String(input.target))
      ? (String(input.target) as IssueReportRecord["target"])
      : "work_order";
    const id = randomUUID();
    const state = await readWorkflowState();
    const record: IssueReportRecord = {
      id,
      orgId,
      severity,
      summary: cleanString(input.summary, "Untitled issue"),
      vessel: cleanString(input.vessel) || undefined,
      equipment: cleanString(input.equipment) || undefined,
      location: cleanString(input.location) || undefined,
      impact: cleanString(input.impact) || undefined,
      evidenceNote: cleanString(input.evidenceNote) || undefined,
      owner: cleanString(input.owner) || undefined,
      dueDate: cleanString(input.dueDate) || undefined,
      target,
      suggestedHref: issueHref(target, id),
      status: input.status === "submitted" ? "submitted" : "draft",
      createdAt: new Date().toISOString(),
      authorId,
    };
    state.issueReports = [record, ...state.issueReports].slice(0, 500);
    await writeWorkflowState(state);
    return record;
  }
}

export function createAttentionWorkflowService(
  sources: AttentionWorkflowSources
): AttentionWorkflowService {
  return new AttentionWorkflowService(sources);
}
