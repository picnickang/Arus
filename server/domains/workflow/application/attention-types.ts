export type WorkflowSeverity = "critical" | "warning" | "info" | "success";
export type WorkflowQueueId =
  | "needs_review"
  | "open_work"
  | "due_today"
  | "blocked"
  | "waiting_parts"
  | "ready_to_close"
  | "completed"
  | "overdue";
export type AttentionSourceType =
  | "work_order"
  | "alert"
  | "equipment"
  | "inventory"
  | "handover"
  | "system";

export type AttentionSourceHealthStatus = "ok" | "failed" | "not_configured";

export interface AttentionSourceHealth {
  workOrders: AttentionSourceHealthStatus;
  alerts: AttentionSourceHealthStatus;
  equipment: AttentionSourceHealthStatus;
  inventory: AttentionSourceHealthStatus;
  errors?: Record<string, string>;
}

export interface BlockerResolutionSummary {
  status: "updated" | "waiting" | "unblocked" | "deferred";
  owner?: string | undefined;
  eta?: string | undefined;
  note?: string | undefined;
  savedAt: string;
}

export interface AttentionWorkflowItem {
  id: string;
  type: AttentionSourceType;
  sourceId?: string;
  title: string;
  source: string;
  whyItMatters: string;
  recommendedAction: string;
  owner: string;
  due: string;
  href: string;
  severity: WorkflowSeverity;
  queue: WorkflowQueueId;
  status?: string | null;
  blockerReason?: string | null;
  lastResolution?: BlockerResolutionSummary | null;
}

export interface AttentionWorkflowQueue {
  id: WorkflowQueueId;
  label: string;
  description: string;
  count: number;
  href: string;
  severity: WorkflowSeverity;
}

export interface AttentionHandoverSummary {
  openAttentionItems: number;
  criticalItems: number;
  blockedJobs: number;
  waitingOnParts: number;
  readyForCloseout: number;
  openWorkOrders: number;
  lowStockParts: number;
  suggestedSummary: string[];
}

export interface AttentionWorkflowResponse {
  generatedAt: string;
  items: AttentionWorkflowItem[];
  queues: AttentionWorkflowQueue[];
  handover: AttentionHandoverSummary;
  sources: AttentionSourceHealth;
}

export interface HandoverRecord {
  id: string;
  orgId: string;
  note: string;
  watchLabel?: string | undefined;
  generatedSummary: string;
  itemIds: string[];
  authorId?: string | undefined;
  status: "draft" | "shared" | "acknowledged";
  savedAt: string;
}

export interface BlockerResolutionRecord {
  id: string;
  orgId: string;
  itemId: string;
  workOrderId?: string | undefined;
  inventoryItemId?: string | undefined;
  blockerType: string;
  reason: string;
  owner?: string | undefined;
  eta?: string | undefined;
  status: "updated" | "waiting" | "unblocked" | "deferred";
  note?: string | undefined;
  savedAt: string;
  authorId?: string | undefined;
}

export interface IssueReportRecord {
  id: string;
  orgId: string;
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  vessel?: string | undefined;
  equipment?: string | undefined;
  location?: string | undefined;
  impact?: string | undefined;
  evidenceNote?: string | undefined;
  owner?: string | undefined;
  dueDate?: string | undefined;
  target: "work_order" | "finding" | "log_note" | "handover";
  suggestedHref: string;
  status: "draft" | "submitted";
  createdAt: string;
  authorId?: string | undefined;
}

export type WorkflowState = {
  handovers: HandoverRecord[];
  blockerResolutions: BlockerResolutionRecord[];
  issueReports: IssueReportRecord[];
};

export type RecordLike = Record<string, unknown>;

export type SafeCallResult<T> = {
  data: T | null;
  status: AttentionSourceHealthStatus;
  error?: string;
};
