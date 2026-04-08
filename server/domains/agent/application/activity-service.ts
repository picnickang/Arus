import type { ActivityPort, AgentActivityItem, ActivitySummary, ActivityFilter } from "../domain/activity-types";

const COST_PER_1K_TOKENS = 0.002;

export class AgentActivityService {
  constructor(private readonly port: ActivityPort) {}

  async list(orgId: string, filter?: ActivityFilter): Promise<AgentActivityItem[]> {
    return this.port.list(orgId, filter);
  }

  async summary(orgId: string): Promise<ActivitySummary> {
    const raw = await this.port.getRawMetrics(orgId);

    const successRate7d = raw.totalRuns7d > 0
      ? Math.round((raw.successCount7d / raw.totalRuns7d) * 100)
      : 100;

    const avgTokensPerRun = raw.tokenRunCount > 0
      ? Math.round(raw.totalTokens30d / raw.tokenRunCount)
      : 0;

    const estimatedCost30d = Math.round((raw.totalTokens30d / 1000) * COST_PER_1K_TOKENS * 100) / 100;

    return {
      runsToday: raw.runsToday,
      successRate7d,
      avgTokensPerRun,
      estimatedCost30d,
      failureCount7d: raw.failureCount7d,
      totalRuns7d: raw.totalRuns7d,
      totalRuns30d: raw.totalRuns30d,
    };
  }
}
