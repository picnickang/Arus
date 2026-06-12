export interface PendingOperation {
  id: string;
  type: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export interface ScheduleAssignment {
  id: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  startDate: string;
  endDate: string;
  role: string;
  status: "draft" | "confirmed" | "published";
  shiftPattern?: string;
  notes?: string;
  constraints?: ConstraintResult[];
  source?: "manual" | "generator" | null;
  generatedByRunId?: string | null;
}

export interface PlannerCrewMember {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
  skills: string[];
  active: boolean;
  certifications?: string[];
  onLeave?: boolean;
  leaveStart?: string;
  leaveEnd?: string;
  availability?: "available" | "on_duty" | "leave" | "pending";
}

export interface PlannerVessel {
  id: string;
  name: string;
  type?: string;
  crewRequirements?: { role: string; count: number }[];
}

export interface ConstraintResult {
  severity: "HARD" | "SOFT";
  code: string;
  message: string;
  affectedIds?: { crewId?: string; assignmentId?: string; vesselId?: string };
}

export interface AiSuggestion {
  id: string;
  suggestedCrewId: string;
  suggestedCrewName: string;
  suggestedCrewRank?: string;
  reason: string;
  score: number;
  constraints: string[];
  availability?: "available" | "on_duty" | "leave";
  certStatus?: "valid" | "expiring" | "expired";
  badgeCode?: string;
}

export type FatigueRiskLevel = "low" | "medium" | "high" | "critical";

export interface FatigueResult {
  crewId: string;
  crewName: string;
  riskLevel: FatigueRiskLevel;
  score: number;
  metrics: {
    sleepDebt24h: number;
    sleepDebt7d: number;
    consecutiveNightShifts: number;
    timeSinceLastFullRest: number;
    nightWorkRatio: number;
    avgRestPer24h: number;
    avgRestPer7d: number;
  };
  factors: string[];
  recommendations: string[];
}

export type DateRangePreset = "2w" | "1m" | "3m";
export type SyncStatus = "up_to_date" | "syncing" | "offline" | "error";
