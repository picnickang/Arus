/**
 * STCW Storage Types
 * Hours of Rest compliance and scheduling
 */

import type {
  SelectCrewRestSheet,
  InsertCrewRestSheet,
  SelectCrewRestDay,
  InsertCrewRestDay,
  SelectSchedulerRun,
  InsertSchedulerRun,
  SelectScheduleAssignment,
  InsertScheduleAssignment,
  SelectScheduleUnfilled,
  InsertScheduleUnfilled,
} from "@shared/schema-runtime";

export interface RestSheetFilters {
  crewId?: string;
  month?: string;
  vesselId?: string;
}

export interface SchedulerRunFilters {
  vesselId?: string;
  status?: string;
  month?: string;
}

/**
 * STCW Storage Interface
 */
export interface IStcwStorage {
  // Rest sheets
  getRestSheets(orgId: string, filters?: RestSheetFilters): Promise<SelectCrewRestSheet[]>;
  getRestSheetById(id: string, orgId: string): Promise<SelectCrewRestSheet | undefined>;
  getRestSheetByCrewAndMonth(crewId: string, month: string, orgId: string): Promise<SelectCrewRestSheet | undefined>;
  createRestSheet(sheet: InsertCrewRestSheet): Promise<SelectCrewRestSheet>;
  updateRestSheet(id: string, sheet: Partial<InsertCrewRestSheet>, orgId: string): Promise<SelectCrewRestSheet>;
  deleteRestSheet(id: string, orgId: string): Promise<void>;

  // Rest days
  getRestDays(sheetId: string, orgId: string): Promise<SelectCrewRestDay[]>;
  getRestDayByDate(sheetId: string, date: string, orgId: string): Promise<SelectCrewRestDay | undefined>;
  upsertRestDay(day: InsertCrewRestDay): Promise<SelectCrewRestDay>;
  bulkUpsertRestDays(days: InsertCrewRestDay[]): Promise<SelectCrewRestDay[]>;
  deleteRestDay(id: string, orgId: string): Promise<void>;

  // Scheduler runs
  getSchedulerRuns(orgId: string, filters?: SchedulerRunFilters): Promise<SelectSchedulerRun[]>;
  getSchedulerRunById(id: string, orgId: string): Promise<SelectSchedulerRun | undefined>;
  createSchedulerRun(run: InsertSchedulerRun): Promise<SelectSchedulerRun>;
  updateSchedulerRun(id: string, run: Partial<InsertSchedulerRun>, orgId: string): Promise<SelectSchedulerRun>;
  deleteSchedulerRun(id: string, orgId: string): Promise<void>;

  // Schedule assignments
  getScheduleAssignments(runId: string, orgId: string): Promise<SelectScheduleAssignment[]>;
  createScheduleAssignment(assignment: InsertScheduleAssignment): Promise<SelectScheduleAssignment>;
  createBulkScheduleAssignments(assignments: InsertScheduleAssignment[]): Promise<SelectScheduleAssignment[]>;
  deleteScheduleAssignment(id: string, orgId: string): Promise<void>;
  deleteScheduleAssignmentsByRun(runId: string, orgId: string): Promise<void>;

  // Schedule unfilled
  getScheduleUnfilled(runId: string, orgId: string): Promise<SelectScheduleUnfilled[]>;
  createScheduleUnfilled(unfilled: InsertScheduleUnfilled): Promise<SelectScheduleUnfilled>;
  createBulkScheduleUnfilled(unfilledList: InsertScheduleUnfilled[]): Promise<SelectScheduleUnfilled[]>;
  deleteScheduleUnfilledByRun(runId: string, orgId: string): Promise<void>;
}

export type {
  SelectCrewRestSheet,
  InsertCrewRestSheet,
  SelectCrewRestDay,
  InsertCrewRestDay,
  SelectSchedulerRun,
  InsertSchedulerRun,
  SelectScheduleAssignment,
  InsertScheduleAssignment,
  SelectScheduleUnfilled,
  InsertScheduleUnfilled,
};
