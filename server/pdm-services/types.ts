/**
 * PdM Services - Types
 * Shared type definitions for predictive maintenance
 */

export interface BaselinePoint {
  vesselName: string;
  assetId: string;
  assetClass: "bearing" | "pump";
  features: Record<string, number>;
}

export interface AnalysisResult {
  features: Record<string, number>;
  scores: Record<string, number>;
  severity: "info" | "warn" | "high";
  worstZ: number;
  explanation: any;
}

export interface AlertRecord {
  vesselName: string;
  assetId: string;
  assetClass: "bearing" | "pump";
  features: Record<string, number>;
  scores: Record<string, number>;
  severity: "info" | "warn" | "high";
  explanation: any;
}

export interface BearingParams {
  orgId: string;
  vesselName: string;
  assetId: string;
  fs: number;
  rpm?: number;
  series: number[];
  spectrum?: { freq: number[]; mag: number[] };
  autoBaseline?: boolean;
}

export interface PumpParams {
  orgId: string;
  vesselName: string;
  assetId: string;
  flow?: number[];
  pressure?: number[];
  current?: number[];
  fs?: number;
  vibSeries?: number[];
  autoBaseline?: boolean;
}
