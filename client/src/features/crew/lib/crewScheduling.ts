import { format, addDays } from "date-fns";
import { z } from "zod";
import { insertShiftTemplateSchema } from "@shared/schema";

export interface ScheduleAssignment {
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

export interface SchedulePlanResponse {
  scheduled: number;
  assignments: ScheduleAssignment[];
  unfilled: UnfilledShift[];
  message: string;
}

export interface EnhancedSchedulePlanResponse {
  engine: string;
  scheduled: ScheduleAssignment[];
  unfilled: UnfilledShift[];
  compliance?:
    | {
        overall_ok: boolean;
        per_crew: Array<{
          crew_id: string;
          name: string;
          ok: boolean;
          min_rest_24: number;
          rest_7d: number;
          nights_this_week: number;
          violations: number;
        }>;
        rows_by_crew: { [crewId: string]: ComplianceRow[] };
      }
    | undefined;
  summary: {
    totalShifts: number;
    scheduledAssignments: number;
    unfilledPositions: number;
    coverage?: number | undefined;
  };
}

export interface SchedulingPreferences {
  weights: {
    unfilled: number;
    fairness: number;
    night_over: number;
    consec_night: number;
    pref_off: number;
    vessel_mismatch: number;
  };
  rules: {
    max_nights_per_week: number;
  };
  per_crew: PerCrewPreference[];
}

export const DEFAULT_SCHEDULING_PREFERENCES: SchedulingPreferences = {
  weights: {
    unfilled: 1000,
    fairness: 20,
    night_over: 10,
    consec_night: 8,
    pref_off: 6,
    vessel_mismatch: 3,
  },
  rules: {
    max_nights_per_week: 4,
  },
  per_crew: [],
};

export function generateDayRange(days: number): string[] {
  const today = new Date();
  const dayList: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    dayList.push(format(date, "yyyy-MM-dd"));
  }
  return dayList;
}

interface ComplianceRow {
  date: string;
  workHours: number;
  restHours: number;
  violations: string[];
}
interface PerCrewPreference {
  crewId: string;
  maxNights?: number;
  preferredShifts?: string[];
}
interface RawScheduleResponse {
  engine?: string | undefined;
  scheduled?: unknown[] | undefined;
  unfilled?: unknown[] | undefined;
  compliance?: EnhancedSchedulePlanResponse["compliance"] | undefined;
  summary?:
    | {
        totalShifts?: number | undefined;
        scheduledAssignments?: number | undefined;
        unfilledPositions?: number | undefined;
        coverage?: number | undefined;
      }
    | undefined;
}

export function parseEnhancedScheduleResponse(
  data: RawScheduleResponse
): EnhancedSchedulePlanResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response format: not an object");
  }

  if (!data.summary || typeof data.summary !== "object") {
    throw new Error("Invalid response format: missing summary object");
  }

  return {
    engine: data.engine || "unknown",
    scheduled: (Array.isArray(data.scheduled) ? data.scheduled : []) as never,
    unfilled: (Array.isArray(data.unfilled) ? data.unfilled : []) as never,
    compliance: data.compliance,
    summary: {
      totalShifts: Number(data.summary.totalShifts) || 0,
      scheduledAssignments: Number(data.summary.scheduledAssignments) || 0,
      unfilledPositions: Number(data.summary.unfilledPositions) || 0,
      ...(data.summary.coverage !== undefined && { coverage: data.summary.coverage }),
    },
  };
}

export function calculateCoverage(summary: EnhancedSchedulePlanResponse["summary"]): number {
  return (
    summary.coverage ||
    (summary.totalShifts > 0 ? (summary.scheduledAssignments / summary.totalShifts) * 100 : 0)
  );
}

export function saveProposedRowsToStorage(
  compliance: EnhancedSchedulePlanResponse["compliance"]
): void {
  if (compliance?.rows_by_crew) {
    try {
      localStorage.setItem("hor_proposed_rows", JSON.stringify(compliance.rows_by_crew));
    } catch (error) {
      console.warn("Failed to save proposed HoR rows to localStorage:", error);
    }
  }
}

export function getShiftTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

interface CertificationRecord {
  crewId: string;
  id?: string;
  cert?: string;
  expiresAt?: string;
}

function groupCertificationsByCrew(certifications: CertificationRecord[]): {
  [crewId: string]: CertificationRecord[];
} {
  return certifications.reduce((acc: Record<string, CertificationRecord[]>, cert) => {
    (acc[cert.crewId] ||= []).push(cert);
    return acc;
  }, {});
}

interface ShiftData {
  id: string;
  vesselId?: string;
  role: string;
  start: string;
  end: string;
}
interface CrewData {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
  skills: string[];
}
interface LeaveData {
  crewId: string;
  start: string;
  end: string;
}
interface PortCallData {
  vesselId: string;
  port: string;
  start: string;
  end: string;
}
interface DrydockData {
  vesselId: string;
  description: string;
  start: string;
  end: string;
}

export function buildEnhancedPlanPayload(options: {
  engine: string;
  days: string[];
  shifts: ShiftData[];
  crew: CrewData[];
  leaves: LeaveData[];
  portCalls: PortCallData[];
  drydocks: DrydockData[];
  certifications: CertificationRecord[];
  preferences: SchedulingPreferences;
  validateSTCW: boolean;
}) {
  return {
    engine: options.engine,
    days: options.days,
    shifts: options.shifts,
    crew: options.crew,
    leaves: options.leaves,
    portCalls: options.portCalls,
    drydocks: options.drydocks,
    certifications: groupCertificationsByCrew(options.certifications),
    preferences: options.preferences,
    validate_stcw: options.validateSTCW,
  };
}

export const shiftFormSchema = insertShiftTemplateSchema.extend({
  role: z.string().min(1, "Role is required"),
  start: z.string().min(1, "Start time is required"),
  end: z.string().min(1, "End time is required"),
  durationH: z.coerce
    .number()
    .min(0.5, "Duration must be at least 0.5 hours")
    .max(24, "Duration cannot exceed 24 hours"),
});

export type ShiftFormData = z.infer<typeof shiftFormSchema>;

export function createDefaultShiftFormValues(): ShiftFormData {
  return {
    orgId: "",
    vesselId: "",
    equipmentId: "",
    role: "",
    start: "",
    end: "",
    durationH: 4,
    requiredSkills: "",
    rankMin: "",
    certRequired: "",
  };
}

export function createDefaultPortCall() {
  return { vesselId: "", port: "", start: "", end: "", crewRequired: 2 };
}

export function createDefaultDrydock() {
  return { vesselId: "", description: "", start: "", end: "", crewRequired: 5 };
}
