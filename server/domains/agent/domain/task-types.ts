export const TASK_STATUSES = ["open", "in_progress", "blocked", "completed", "failed", "deferred"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_SOURCES = ["suggestion", "signal", "user", "scheduled"] as const;
export type TaskSource = typeof TASK_SOURCES[number];

export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "blocked", "deferred", "failed"],
  in_progress: ["completed", "failed", "blocked", "deferred"],
  blocked: ["open", "in_progress", "failed", "deferred"],
  completed: [],
  failed: ["open"],
  deferred: ["open", "in_progress"],
};

export function isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface AgentTaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  source?: TaskSource;
  equipmentId?: string;
  vesselId?: string;
  limit?: number;
  offset?: number;
}

export interface AgentTaskRepositoryPort {
  create(data: import("@shared/schema").InsertAgentTask): Promise<import("@shared/schema").AgentTask>;
  getById(id: string, orgId: string): Promise<import("@shared/schema").AgentTask | null>;
  list(orgId: string, filter?: AgentTaskFilter): Promise<import("@shared/schema").AgentTask[]>;
  update(id: string, data: Partial<import("@shared/schema").AgentTask>): Promise<import("@shared/schema").AgentTask>;
  countByStatus(orgId: string): Promise<Record<string, number>>;
}
