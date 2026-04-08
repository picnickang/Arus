export type FindingSource = "suggestion" | "draft" | "schedule_run";

export type FindingSeverity = "info" | "warning" | "critical";

export type FindingStatus =
  | "pending"
  | "acted"
  | "dismissed"
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
}

export interface FindingsSummary {
  pendingApprovals: number;
  pendingSuggestions: number;
  recentFailures: number;
  totalFindings: number;
}

export interface FindingsFilter {
  source?: FindingSource;
  severity?: FindingSeverity;
  status?: FindingStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface FindingsPagination {
  limit: number;
  offset: number;
}

export interface FindingsAggregatorPort {
  getFindings(
    orgId: string,
    filter?: FindingsFilter,
    pagination?: FindingsPagination,
  ): Promise<{ items: UnifiedFindingItem[]; total: number }>;

  getSummary(orgId: string): Promise<FindingsSummary>;
}
