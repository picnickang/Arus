/**
 * Crew Scheduler OR-Tools - Types
 * Shared type definitions for scheduling
 */

import {
  crew,
  shiftTemplate,
  crewLeave,
  crewCertification,
  portCall,
  drydockWindow,
} from "@shared/schema-runtime";

// Locally-derived select types — these types historically lived in
// @shared/schema-runtime as named re-exports but were never actually
// exported there. Inferring them directly from the table objects keeps
// the contract identical to what consumers expected.
export type SelectShiftTemplate = typeof shiftTemplate.$inferSelect;
export type SelectCrewLeave = typeof crewLeave.$inferSelect;
export type SelectCrewCertification = typeof crewCertification.$inferSelect;
export type SelectPortCall = typeof portCall.$inferSelect;
export type SelectDrydockWindow = typeof drydockWindow.$inferSelect;
export type CrewWithSkills = typeof crew.$inferSelect & { skills?: string[] };

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
  preferences?: SchedulingPreferences | undefined;
}

export interface Assignment {
  date: string;
  shiftId: string;
  crewId: string;
  vesselId?: string | undefined;
  start: string;
  end: string;
  role?: string | undefined;
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
