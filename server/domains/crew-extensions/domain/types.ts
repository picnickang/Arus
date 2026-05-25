/**
 * Crew Extensions Domain Types
 * Pure domain entities and value objects
 */

export interface SchedulerRunEntity {
  id: string;
  orgId: string;
  status: "pending" | "approved" | "applied" | "cancelled" | "draft";
  startDate: Date | null;
  endDate: Date | null;
  totalAssignments: number | null;
  unfilledCount: number | null;
  inputHash: string | null;
  generatedByRunId: string | null;
  horGenerated: boolean;
  createdAt: Date;
  completedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
}

export interface ScheduleAssignmentEntity {
  id: string;
  runId: string;
  crewId: string;
  vesselId: string;
  date: Date;
  shift: "day" | "night" | "full_day";
  role: string | null;
  status: "proposed" | "approved" | "applied" | "cancelled";
  createdAt: Date;
}

export interface ScheduleUnfilledEntity {
  id: string;
  runId: string;
  vesselId: string;
  date: Date;
  shift: "day" | "night" | "full_day";
  role: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface CreateSchedulerRunCommand {
  orgId: string;
  status?: "pending" | "approved" | "applied" | "cancelled" | "draft";
  startDate?: Date | null;
  endDate?: Date | null;
  inputHash?: string | null;
}

export interface PlanScheduleCommand {
  orgId: string;
  from: string;
  days: number;
  vessels?: string[];
  mode: "dry_run" | "simulate" | "execute";
}

export interface ApplyScheduleCommand {
  runId: string;
  orgId: string;
  userId?: string;
}

export interface ConstraintViolation {
  type: "hard" | "soft";
  code: string;
  message: string;
  crewId?: string;
  assignmentId?: string;
}

export interface CompliancePreviewResult {
  isCompliant: boolean;
  violations: ConstraintViolation[];
  summary: {
    totalCrew: number;
    compliantCrew: number;
    violationCount: number;
    warningCount: number;
  };
}

/**
 * SIMULATE mode types for in-memory schedule preview
 */

export interface SimulateScheduleCommand {
  orgId: string;
  from: string;
  days: number;
  vessels?: string[] | undefined;
  crewIds?: string[] | undefined;
  strategy?: SimulationStrategy | undefined;
}

export type SimulationStrategy = "balanced" | "minimize_changes" | "maximize_rest" | "fill_gaps";

export interface SimulationPreview {
  previewId: string;
  orgId: string;
  createdAt: Date;
  expiresAt: Date;
  command: SimulateScheduleCommand;
  proposedAssignments: ProposedAssignment[];
  unfilledShifts: SimulationUnfilledShift[];
  compliance: CompliancePreviewResult;
  diff: SimulationDiff;
  summary: SimulationSummary;
}

export interface ProposedAssignment {
  tempId: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  date: string;
  shift: "day" | "night" | "full_day";
  role: string | null;
  changeType: "add" | "modify" | "remove";
  originalAssignmentId?: string;
  confidence: number;
  reason: string;
}

export interface SimulationUnfilledShift {
  date: string;
  shift: "day" | "night" | "full_day";
  vesselId: string;
  vesselName: string;
  role: string | null;
  reason: string;
  alternativeCrew: string[];
}

export interface SimulationDiff {
  added: number;
  modified: number;
  removed: number;
  unchanged: number;
  crewAffected: string[];
}

export interface SimulationSummary {
  totalProposed: number;
  totalUnfilled: number;
  complianceRate: number;
  crewUtilization: number;
  estimatedHoursChange: number;
}

export interface CommitSimulationCommand {
  previewId: string;
  orgId: string;
  userId?: string | undefined;
  selectedAssignmentIds?: string[] | undefined;
}
