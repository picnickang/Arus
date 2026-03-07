import type { AssetTwin, AssetTwinState, TwinResidual } from "@shared/schema";

export interface TwinFreshnessInfo {
  twinId: string;
  twinName: string;
  equipmentId: string;
  status: string;
  lastStateUpdate: Date | null;
  lastResidualUpdate: Date | null;
  isStale: boolean;
  staleSinceMinutes: number | null;
}

export interface ITwinFreshnessStorage {
  getActiveTwins(orgId: string): Promise<AssetTwin[]>;
  getLatestStateTimestamp(orgId: string, twinId: string): Promise<Date | null>;
  getLatestResidualTimestamp(orgId: string, twinId: string): Promise<Date | null>;
}

export interface ITwinUpdateScheduler {
  refreshOneTwin(orgId: string, twinId: string): Promise<{ state: AssetTwinState; residuals: TwinResidual[] }>;
  refreshAllActiveTwins(orgId: string): Promise<{ refreshed: number; failed: number; results: Array<{ twinId: string; success: boolean; error?: string }> }>;
  getFreshnessStatus(orgId: string): Promise<TwinFreshnessInfo[]>;
  getTwinFreshness(orgId: string, twinId: string): Promise<TwinFreshnessInfo | null>;
}
