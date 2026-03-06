import type { FleetBaseline, InsertFleetBaseline } from "@shared/schema";

export interface FleetComparisonResult {
  featureName: string;
  equipmentValue: number;
  fleetMean: number;
  fleetStddev: number;
  zScore: number;
  percentile: number;
  status: "normal" | "warning" | "critical";
}

export interface FleetAnalyticsPort {
  computeBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]>;
  getBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]>;
  compareToFleet(orgId: string, equipmentId: string, equipmentType: string): Promise<FleetComparisonResult[]>;
}
