/**
 * Insights Engine Types
 * 
 * Type definitions for fleet KPI analysis and risk assessment.
 */

import type { StatusLevel, Priority } from "@shared/technician-status";

export interface FleetKPI {
  fleet: {
    vessels: number;
    signalsMapped: number;
    signalsDiscovered: number;
    dq7d: number;
    latestGapVessels: string[];
  };
  perVessel: Record<
    string,
    {
      vesselName: string;
      lastTs: string | null;
      dq7d: number;
      totalSignals: number;
      stale: boolean;
    }
  >;
}

export interface InsightBundle {
  kpi: FleetKPI;
  risks: { critical: string[]; warnings: string[] };
  recommendations: string[];
  anomalies: Array<{
    vesselId: string;
    src: string;
    sig: string;
    kind: string;
    severity: string;
    tStart: string;
    tEnd: string;
  }>;
  compliance: { horViolations7d?: number; notes?: string[] };
}

export interface TechnicianInsightView {
  equipmentId: string;
  equipmentName: string;
  plainLanguageName: string | null;
  vesselId: string | null;
  vesselName: string | null;
  systemType: string | null;
  componentType: string | null;
  criticalityLevel: string;

  statusLevel: StatusLevel;
  statusLabel: string;
  statusColor: string;
  priority: Priority;
  priorityTimeframe: string;

  summary: string;
  explanation: string;
  confidence: string;

  actionSteps: string[];

  mlPrediction: {
    failureProbability: number;
    confidence: number;
    daysUntilFailure: number | null;
    triggers: Array<{
      sensorType: string;
      value: number;
      threshold: number;
      deviation: string;
    }>;
  };

  lastUpdated: Date;
  nextReviewDate: Date | null;
}

export interface TriggerInfo {
  sensorType: string;
  value: number;
  threshold: number;
  deviation: string;
}

export interface VesselInsightGroup {
  vesselId: string;
  vesselName: string;
  insights: TechnicianInsightView[];
}
