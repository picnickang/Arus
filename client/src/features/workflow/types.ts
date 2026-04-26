export type WorkflowSeverity = "critical" | "warning" | "info" | "success";
export type WorkflowStatus =
  | "needs_review"
  | "assigned"
  | "due_today"
  | "blocked"
  | "waiting_parts"
  | "ready_to_close"
  | "completed"
  | "overdue";

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
  title: string;
  source: string;
  whyItMatters: string;
  recommendedAction: string;
  owner: string;
  due: string;
  href: string;
  severity: WorkflowSeverity;
}

export interface WorkOrderRecord {
  id: string | number;
  title?: string;
  status?: string;
  priority?: number | string | null;
  dueDate?: string | null;
  blockedReason?: string | null;
  equipmentName?: string | null;
  equipment?: { name?: string | null } | null;
}
