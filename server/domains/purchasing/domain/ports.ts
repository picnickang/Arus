import type { PipelineDataSources } from "./types";

export interface IPurchaseEventRepository {
  getPipelineData(prId: string, orgId: string): Promise<PipelineDataSources | null>;
  resolveUserNames(userIds: string[]): Promise<Map<string, string>>;
}
