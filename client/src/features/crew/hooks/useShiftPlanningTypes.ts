import type { SelectShiftTemplate } from "@shared/schema";
import type { SchedulingPreferences } from "@/features/crew";

export interface ShiftPlanningCrew {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
  maxHours7d: number;
  minRestH: number;
  active: boolean;
  skills: string[];
}

export interface ShiftPlanningPortCall {
  id: string;
  vesselId: string;
  port: string;
  start: string;
  end: string;
  crewRequired: number;
}

export interface ShiftPlanningDrydockWindow {
  id: string;
  vesselId: string;
  description: string;
  start: string;
  end: string;
  crewRequired: number;
}

export interface ShiftPlanningCrewCertification {
  id: string;
  crewId: string;
  cert: string;
  expiresAt: string;
  issuedBy?: string;
}

export interface VesselData {
  id: string;
  name: string;
}

export interface LeaveData {
  id: string;
  crewId: string;
  start: string;
  end: string;
  type: string;
}

export interface SchedulePlanPayload {
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: ShiftPlanningCrew[];
  leaves: LeaveData[];
  existing: unknown[];
}

export interface EnhancedSchedulePayload {
  engine: string;
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: ShiftPlanningCrew[];
  leaves: LeaveData[];
  portCalls: ShiftPlanningPortCall[];
  drydocks: ShiftPlanningDrydockWindow[];
  certifications: Record<string, ShiftPlanningCrewCertification[]>;
  preferences: SchedulingPreferences;
  validate_stcw: boolean;
}
