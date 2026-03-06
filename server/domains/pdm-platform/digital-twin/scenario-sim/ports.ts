import type { TwinScenario, InsertTwinScenario } from "@shared/schema";

export interface ScenarioSimPort {
  listScenarios(orgId: string, twinId: string): Promise<TwinScenario[]>;
  getScenario(orgId: string, scenarioId: string): Promise<TwinScenario | null>;
  saveScenario(data: InsertTwinScenario): Promise<TwinScenario>;
}

export interface ScenarioParameters {
  loadPercent?: number;
  temperatureOffset?: number;
  maintenanceDelayDays?: number;
}

export interface ScenarioResult {
  projectedHealthScore: number;
  projectedEfficiencyScore: number;
  projectedRulHours: number;
  baselineHealthScore: number;
  baselineEfficiencyScore: number;
  baselineRulHours: number;
  impact: {
    healthDelta: number;
    efficiencyDelta: number;
    rulDeltaHours: number;
    riskLevel: string;
    summary: string;
  };
}
