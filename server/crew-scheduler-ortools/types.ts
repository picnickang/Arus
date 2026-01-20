/**
 * Crew Scheduler OR-Tools - Types
 * Shared type definitions for scheduling
 */

import {
  CrewWithSkills,
  SelectShiftTemplate,
  SelectCrewLeave,
  SelectPortCall,
  SelectDrydockWindow,
  SelectCrewCertification,
} from "@shared/schema-runtime";

export const ENGINE_GREEDY = "greedy";
export const ENGINE_OR_TOOLS = "ortools";

export interface SchedulingPreferences {
  weights?: {
    unfilled?: number;
    fairness?: number;
    night_over?: number;
    consec_night?: number;
    pref_off?: number;
    vessel_mismatch?: number;
  };
  rules?: {
    max_nights_per_week?: number;
  };
  per_crew?: Array<{
    crew_id: string;
    days_off?: string[];
    prefer_vessel?: string;
  }>;
}

export interface ConstraintScheduleRequest {
  engine: string;
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: CrewWithSkills[];
  leaves: SelectCrewLeave[];
  portCalls: SelectPortCall[];
  drydocks: SelectDrydockWindow[];
  certifications: { [crewId: string]: SelectCrewCertification[] };
  preferences?: SchedulingPreferences;
}

export interface Assignment {
  date: string;
  shiftId: string;
  crewId: string;
  vesselId?: string;
  start: string;
  end: string;
  role?: string;
}

export interface UnfilledShift {
  day: string;
  shiftId: string;
  need: number;
  reason: string;
}

export interface ScheduleResult {
  scheduled: Assignment[];
  unfilled: UnfilledShift[];
}
