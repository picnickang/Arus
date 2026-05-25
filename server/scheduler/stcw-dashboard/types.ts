/**
 * STCW Dashboard Types - Interface definitions for compliance summaries
 */

import type { RestDay } from "../../stcw-compliance";

export interface VesselComplianceSummary {
  vesselId: string;
  vesselName: string;
  totalCrew: number;
  compliantCrew: number;
  complianceRate: number;
  violationCount: number;
  warningCount: number;
  highFatigueCount: number;
  criticalFatigueCount: number;
  avgRestPer24h: number;
  avgRestPer7d: number;
}

export interface FleetSTCWSummary {
  orgId: string;
  lookbackDays: number;
  calculatedAt: string;
  fleet: {
    totalVessels: number;
    totalCrew: number;
    compliantCrew: number;
    overallComplianceRate: number;
    totalViolations: number;
    totalWarnings: number;
    highFatigueCount: number;
    criticalFatigueCount: number;
    avgRestPer24h: number;
    avgRestPer7d: number;
  };
  vessels: VesselComplianceSummary[];
  topIssues: Array<{
    crewId: string;
    crewName: string;
    vesselId: string;
    issueType: "violation" | "high_fatigue" | "critical_fatigue";
    description: string;
    severity: "warning" | "critical";
  }>;
}

export interface VesselDetailedSummary extends VesselComplianceSummary {
  crewDetails: Array<{
    crewId: string;
    crewName: string;
    isCompliant: boolean;
    violationCount: number;
    warningCount: number;
    fatigueLevel: "low" | "medium" | "high" | "critical";
    fatigueScore: number;
    avgRestPer24h: number;
    recentIssues: Array<{
      date: string;
      rule: string;
      description: string;
    }>;
  }>;
}

export interface TrendDataPoint {
  date: string;
  complianceRate: number;
  violationCount: number;
  warningCount: number;
  highFatigueRate: number;
  avgRest24h: number;
}

export interface STCWTrends {
  orgId: string;
  vesselId?: string | undefined;
  lookbackDays: number;
  calculatedAt: string;
  trends: TrendDataPoint[];
  summary: {
    complianceRateChange: number;
    violationTrend: "increasing" | "stable" | "decreasing";
    fatigueRiskTrend: "increasing" | "stable" | "decreasing";
  };
}

export interface CrewRestData {
  crewId: string;
  crewName: string;
  days: RestDay[];
}
