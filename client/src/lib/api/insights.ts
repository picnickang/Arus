import { apiRequest } from "../queryClient";

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
