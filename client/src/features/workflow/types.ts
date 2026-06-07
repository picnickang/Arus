export type WorkflowSeverity = "critical" | "warning" | "info" | "success";
export type WorkflowStatus =
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

export interface WorkflowQueue {
  id: WorkflowStatus;
  label: string;
  description: string;
  count: number;
  href: string;
  severity: WorkflowSeverity;
}

export interface WorkflowAction {
  id: string;
  label: string;
  description: string;
  href: string;
  severity: WorkflowSeverity;
}

export interface BlockerResolutionSummary {
  status: "updated" | "waiting" | "unblocked" | "deferred";
  owner?: string;
  eta?: string;
  note?: string;
  savedAt: string;
}

export interface AttentionItem {
  id: string;
  type?: AttentionSourceType;
  sourceId?: string;
  title: string;
  source: string;
  whyItMatters: string;
  recommendedAction: string;
  owner: string;
  due: string;
  href: string;
  severity: WorkflowSeverity;
  queue?: WorkflowStatus;
  status?: string | null;
  blockerReason?: string | null;
  lastResolution?: BlockerResolutionSummary | null;
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
  items: AttentionItem[];
  queues: WorkflowQueue[];
  handover: AttentionHandoverSummary;
  sources: AttentionSourceHealth;
}

export interface HandoverRecord {
  id: string;
  orgId: string;
  note: string;
  watchLabel?: string;
  generatedSummary: string;
  itemIds: string[];
  authorId?: string;
  status: "draft" | "shared" | "acknowledged";
  savedAt: string;
}

export interface BlockerResolutionRecord {
  id: string;
  orgId: string;
  itemId: string;
  workOrderId?: string;
  inventoryItemId?: string;
  blockerType: string;
  reason: string;
  owner?: string;
  eta?: string;
  status: "updated" | "waiting" | "unblocked" | "deferred";
  note?: string;
  savedAt: string;
  authorId?: string;
}

export interface IssueReportRecord {
  id: string;
  orgId: string;
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  vessel?: string;
  equipment?: string;
  location?: string;
  impact?: string;
  evidenceNote?: string;
  owner?: string;
  dueDate?: string;
  target: "work_order" | "finding" | "log_note" | "handover";
  suggestedHref: string;
  status: "draft" | "submitted";
  createdAt: string;
  authorId?: string;
}

export interface WorkflowWorkOrderRecord {
  id: string | number;
  title?: string | undefined;
  status?: string | undefined;
  priority?: number | string | null | undefined;
  dueDate?: string | null | undefined;
  blockedReason?: string | null | undefined;
  equipmentName?: string | null | undefined;
  assignedCrewId?: string | null | undefined;
  assignedToName?: string | null | undefined;
  equipment?: { name?: string | null | undefined } | null | undefined;
}
