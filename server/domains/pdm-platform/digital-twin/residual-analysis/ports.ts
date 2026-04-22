import type { TwinResidual, InsertTwinResidual } from "@shared/schema";

export interface ResidualRanking {
  twinId: string;
  sensorType: string;
  avgResidual: number;
  avgZScore: number;
  maxZScore: number;
  severity: "normal" | "warning" | "critical";
  count: number;
}

export interface ResidualAnalysisPort {
  computeResiduals(orgId: string, twinId: string): Promise<TwinResidual[]>;

  getResidualsByTwin(orgId: string, twinId: string, limit?: number): Promise<TwinResidual[]>;

  getResidualRankings(orgId: string): Promise<ResidualRanking[]>;

  storeResiduals(records: InsertTwinResidual[]): Promise<TwinResidual[]>;
}
