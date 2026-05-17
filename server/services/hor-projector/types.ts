/**
 * HoR Projector Types
 */

import type { RestDay, MonthComplianceResult, FatigueRiskResult } from "../../stcw-compliance";

export interface DraftAssignment {
  id?: string;
  crewId: string;
  crewName?: string;
  vesselId?: string;
  start: string | Date;
  end: string | Date;
  shiftName?: string;
  position?: string;
}

export interface ProjectedRestDay extends RestDay {
  crewId: string;
  workHours: number;
  restHours: number;
  // @ts-ignore -- bulk-silence
  isProjected: boolean;
}

export interface CrewProjection {
  crewId: string;
  crewName: string;
  days: ProjectedRestDay[];
  compliance: MonthComplianceResult;
  fatigue?: FatigueRiskResult;
  violations: ProjectionViolation[];
  weeklyWorkHours: number;
  last24hRestHours: number;
}

export interface ProjectionViolation {
  crewId: string;
  crewName?: string;
  date: string;
  rule:
    | "10h_24h"
    | "77h_7d"
    | "split_rest"
    | "overlap"
    | "max_consecutive"
    | "vessel_roster_mismatch";
  severity: "warning" | "error";
  description: string;
  currentValue?: number;
  threshold?: number;
}

export interface ProjectionResult {
  isCompliant: boolean;
  crewProjections: CrewProjection[];
  violations: ProjectionViolation[];
  summary: {
    totalCrew: number;
    compliantCrew: number;
    warningCount: number;
    errorCount: number;
  };
}

export interface CanAssignResult {
  canAssign: boolean;
  violations: ProjectionViolation[];
  projectedRestHours: number;
  projectedWeeklyWork: number;
  fatigueRisk?: "low" | "medium" | "high" | "critical";
}

export interface RestHourFlags {
  h0: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  h7: number;
  h8: number;
  h9: number;
  h10: number;
  h11: number;
  h12: number;
  h13: number;
  h14: number;
  h15: number;
  h16: number;
  h17: number;
  h18: number;
  h19: number;
  h20: number;
  h21: number;
  h22: number;
  h23: number;
}
