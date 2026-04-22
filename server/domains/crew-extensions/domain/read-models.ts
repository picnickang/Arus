/**
 * Crew Extensions Domain - CQRS Read Models
 * Optimized view models for query-side operations
 */

/**
 * Crew member summary for schedule planner board
 */
export interface CrewMemberSummary {
  id: string;
  name: string;
  role: string;
  qualifications: string[];
  certificationStatus: "valid" | "expiring" | "expired";
  hoursWorkedThisWeek: number;
  hoursWorkedThisMonth: number;
  isOnLeave: boolean;
  availability: "available" | "limited" | "unavailable";
}

/**
 * Vessel summary for schedule planner board
 */
export interface VesselSummary {
  id: string;
  name: string;
  requiredCrew: number;
  currentCrew: number;
  operationalStatus: "active" | "docked" | "maintenance";
}

/**
 * Single day cell in the schedule planner board
 */
export interface ScheduleDayCell {
  date: string;
  shift: "day" | "night" | "full_day";
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  role: string | null;
  status: "proposed" | "approved" | "applied" | "cancelled";
  assignmentId: string;
  runId: string;
  hasViolation: boolean;
  violationType?: "hours" | "rest" | "qualification" | "leave";
}

/**
 * Row in the schedule planner board (one per crew member)
 */
export interface SchedulePlannerRow {
  crew: CrewMemberSummary;
  assignments: ScheduleDayCell[];
  totalHours: number;
  complianceScore: number;
  violations: ScheduleViolation[];
}

/**
 * Complete schedule planner board view
 */
export interface SchedulePlannerView {
  dateRange: {
    start: string;
    end: string;
  };
  vessels: VesselSummary[];
  rows: SchedulePlannerRow[];
  unfilledShifts: UnfilledShiftSummary[];
  summary: {
    totalAssignments: number;
    totalUnfilled: number;
    complianceRate: number;
    crewUtilization: number;
  };
  lastRefreshedAt: string;
}

/**
 * Unfilled shift summary
 */
export interface UnfilledShiftSummary {
  date: string;
  shift: "day" | "night" | "full_day";
  vesselId: string;
  vesselName: string;
  role: string | null;
  reason: string | null;
  candidateCrew: string[];
}

/**
 * Schedule violation details
 */
export interface ScheduleViolation {
  type: "hours" | "rest" | "qualification" | "leave" | "overlap";
  severity: "error" | "warning";
  message: string;
  affectedDates: string[];
  crewId: string;
  assignmentId?: string;
}

/**
 * Crew assignment projection for event-driven updates
 */
export interface CrewAssignmentProjection {
  assignmentId: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  date: string;
  shift: "day" | "night" | "full_day";
  role: string | null;
  status: "proposed" | "approved" | "applied" | "cancelled";
  runId: string;
  projectedAt: string;
}

/**
 * Filter criteria for schedule planner queries
 */
export interface SchedulePlannerFilter {
  orgId: string;
  startDate: string;
  endDate: string;
  vesselIds?: string[];
  crewIds?: string[];
  roles?: string[];
  status?: ("proposed" | "approved" | "applied" | "cancelled")[];
  includeUnfilled?: boolean;
}

/**
 * Read model refresh event
 */
export interface ReadModelRefreshEvent {
  type: "SCHEDULE_PLANNER_REFRESH";
  orgId: string;
  triggeredBy: string;
  timestamp: string;
  affectedDateRange?: {
    start: string;
    end: string;
  };
}
