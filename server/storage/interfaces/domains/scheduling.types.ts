/**
 * Scheduling Storage Interface - Scheduler Runs, Assignments, Shifts
 * Part of IStorage modularization for improved maintainability
 */

import type {
  SchedulerRun as SelectSchedulerRun,
  InsertSchedulerRun,
  ScheduleAssignment as SelectScheduleAssignment,
  InsertScheduleAssignment,
  ScheduleUnfilled as SelectScheduleUnfilled,
  InsertScheduleUnfilled,
} from "@shared/schema";

/**
 * Scheduling storage operations for crew scheduling and assignments
 */
export interface ISchedulingStorage {
  // Scheduler Runs
  createSchedulerRun(run: InsertSchedulerRun): Promise<SelectSchedulerRun>;
  updateSchedulerRun(id: string, data: Partial<InsertSchedulerRun>): Promise<SelectSchedulerRun>;
  getSchedulerRuns(orgId: string, limit?: number): Promise<SelectSchedulerRun[]>;
  getSchedulerRun(id: string): Promise<SelectSchedulerRun | undefined>;
  findRecentSchedulerRunByHash(
    orgId: string,
    inputHash: string,
    hoursBack?: number
  ): Promise<SelectSchedulerRun | undefined>;
  approveSchedulerRun(id: string, userId?: string): Promise<SelectSchedulerRun>;
  publishSchedulerRun(id: string, userId: string): Promise<SelectSchedulerRun>;
  cancelSchedulerRun(id: string, userId?: string): Promise<SelectSchedulerRun>;
  getSchedulerRunsByStatus(
    orgId: string,
    status: string,
    limit?: number
  ): Promise<SelectSchedulerRun[]>;
  markSchedulerRunHorGenerated(id: string): Promise<SelectSchedulerRun>;

  // Schedule Assignments
  createBulkScheduleAssignments(assignments: InsertScheduleAssignment[]): Promise<void>;
  getScheduleAssignments(
    orgId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<SelectScheduleAssignment[]>;
  getScheduleAssignmentsByRun(runId: string): Promise<SelectScheduleAssignment[]>;
  deleteScheduleAssignmentsByDateRange(
    orgId: string,
    start: Date,
    end: Date,
    mode?: string
  ): Promise<number>;

  // Schedule Unfilled
  createBulkScheduleUnfilled(unfilled: InsertScheduleUnfilled[]): Promise<void>;
  getScheduleUnfilled(orgId: string, runId?: string): Promise<SelectScheduleUnfilled[]>;
}
