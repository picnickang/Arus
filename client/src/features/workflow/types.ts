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
}

export interface AttentionHandoverSummary {
  openAttentionItems: number;
  criticalItems: number;
  blockedJobs: number;
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
}

export interface WorkOrderRecord {
  id: string | number;
  title?: string;
  status?: string;
  priority?: number | string | null;
  dueDate?: string | null;
  blockedReason?: string | null;
  equipmentName?: string | null;
  assignedCrewId?: string | null;
  assignedToName?: string | null;
  equipment?: { name?: string | null } | null;
}
