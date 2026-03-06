import type { FleetBaseline, InsertFleetBaseline } from "@shared/schema";

export interface FleetComparisonResult {
  featureName: string;
  equipmentValue: number;
  fleetMean: number;
  fleetStddev: number;
  fleetP5: number;
  fleetP95: number;
  zScore: number;
  percentile: number;
  aboveFleetAvg: boolean;
  status: "normal" | "warning" | "critical";
}

export interface FleetAnalyticsPort {
  computeBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]>;
  getBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]>;
  compareToFleet(orgId: string, equipmentId: string, equipmentType: string): Promise<FleetComparisonResult[]>;
}
