export type FindingSource = "suggestion" | "draft" | "schedule_run" | "agent_finding";
export type FindingSeverity = "info" | "warning" | "critical";
export type FindingStatus =
  | "pending"
  | "acted"
  | "dismissed"
  | "deferred"
  | "approved"
  | "rejected"
  | "completed"
  | "failed"
  | "running";

export interface UnifiedFindingItem {
  id: string;
  source: FindingSource;
  sourceId: string;
  title: string;
  summary: string;
  severity: FindingSeverity;
  status: FindingStatus;
  entityType?: string | null;
  entityId?: string | null;
  triggerType?: string | null;
  draftType?: string | null;
  scheduleName?: string | null;
  scheduleId?: string | null;
  requiresAction: boolean;
  createdAt: string;
  updatedAt?: string | null;
  context?: Record<string, unknown> | null;
  outcome?: string | null;
  outcomeReason?: string | null;
  outcomeAt?: string | null;
  outcomeBy?: string | null;
}

export interface AgentTask {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  parentTaskId: string | null;
  equipmentId: string | null;
  vesselId: string | null;
  predictionId: string | null;
  conversationId: string | null;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const TASK_STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  deferred: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

export const TASK_PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "blocked", "deferred"],
  in_progress: ["completed", "failed", "blocked"],
  blocked: ["open", "in_progress", "deferred"],
  deferred: ["open", "in_progress"],
};

export const OUTCOME_CATEGORIES = [
  { value: "useful", label: "Useful" },
  { value: "already_handled", label: "Already Handled" },
  { value: "not_relevant", label: "Not Relevant" },
  { value: "too_late", label: "Too Late" },
  { value: "false_alarm", label: "False Alarm" },
] as const;

export const SOURCE_LABELS: Record<FindingSource, string> = {
  suggestion: "Suggestion",
  draft: "Draft",
  schedule_run: "Scheduled Run",
  agent_finding: "Agent Finding",
};

export const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  acted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  dismissed: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  deferred: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export const ENTITY_ROUTES: Record<string, string> = {
  equipment: "/equipment-intelligence",
  work_order: "/work-orders",
  vessel: "/fleet?tab=vessels",
  part: "/inventory?tab=parts",
  inventory: "/logistics?tab=inventory",
  maintenance_schedule: "/maintenance",
  schedule: "/operations?tab=findings",
};

export const ENTITY_LABELS: Record<string, string> = {
  equipment: "Equipment",
  work_order: "Work Order",
  vessel: "Vessel",
  part: "Part",
  inventory: "Inventory",
  maintenance_schedule: "Maintenance Schedule",
  schedule: "Schedule",
};
