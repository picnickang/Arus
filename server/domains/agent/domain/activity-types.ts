export interface ToolCallEntry {
  toolName: string;
  durationMs?: number | null;
  status: string;
  error?: string | null;
}

export interface AgentActivityItem {
  id: string;
  triggerType: "scheduled" | "user";
  scheduleName?: string | null;
  scheduleId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  status: "completed" | "failed" | "running";
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  tokenUsage?: number | null;
  toolCallCount: number;
  toolCalls: ToolCallEntry[];
  summary?: string | null;
  error?: string | null;
}

export interface ActivitySummary {
  runsToday: number;
  successRate7d: number;
  avgTokensPerRun: number;
  estimatedCost30d: number;
  failureCount7d: number;
  totalRuns7d: number;
  totalRuns30d: number;
}

export interface ActivityFilter {
  triggerType?: "scheduled" | "user";
  status?: "completed" | "failed" | "running";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityPort {
  list(orgId: string, filter?: ActivityFilter): Promise<AgentActivityItem[]>;
  summary(orgId: string): Promise<ActivitySummary>;
}
