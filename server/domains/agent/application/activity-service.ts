import type { ActivityPort, AgentActivityItem, ActivitySummary, ActivityFilter } from "../domain/activity-types";

export class AgentActivityService {
  constructor(private readonly port: ActivityPort) {}

  async list(orgId: string, filter?: ActivityFilter): Promise<AgentActivityItem[]> {
    return this.port.list(orgId, filter);
  }

  async summary(orgId: string): Promise<ActivitySummary> {
    return this.port.summary(orgId);
  }
}
