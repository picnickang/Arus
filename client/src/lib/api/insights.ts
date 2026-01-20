import { apiRequest } from "../queryClient";

export async function fetchInsightSnapshots(orgId?: string, scope?: string) {
  const params = new URLSearchParams();
  if (orgId) {params.append("orgId", orgId);}
  if (scope) {params.append("scope", scope);}
  const url = `/api/insights/snapshots${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest("GET", url);
}

export async function fetchLatestInsightSnapshot(orgId = "default-org-id", scope = "fleet") {
  const url = `/api/insights/snapshots/latest?orgId=${orgId}&scope=${scope}`;
  return apiRequest("GET", url);
}

export async function triggerInsightsGeneration(orgId = "default-org-id", scope = "fleet") {
  return apiRequest("POST", "/api/insights/generate", { orgId, scope });
}

export async function fetchInsightReports(orgId?: string, scope?: string) {
  const params = new URLSearchParams();
  if (orgId) {params.append("orgId", orgId);}
  if (scope) {params.append("scope", scope);}
  const url = `/api/insights/reports${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest("GET", url);
}

export interface InsightsJobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  recentInsightsJobs: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt?: string;
  }>;
}

export async function fetchInsightsJobStats(): Promise<InsightsJobStats> {
  const url = `/api/insights/jobs/stats`;
  const response = await apiRequest("GET", url);
  return response as InsightsJobStats;
}
