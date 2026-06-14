/**
 * Scheduling Domain - Types
 *
 * Entity aliases over @shared/schema (the maintenance + optimizer storage layers
 * return these shapes) plus the scheduling-specific query/result types.
 */

import type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  OptimizerConfiguration,
  OptimizationResult,
} from "@shared/schema";

export type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  OptimizerConfiguration,
  OptimizationResult,
};

/** Filters accepted by the maintenance-schedule queries the scheduling domain runs. */
export interface ScheduleQueryFilters {
  vesselId?: string | undefined;
  status?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

export interface ScheduleConflict {
  schedule1: MaintenanceSchedule;
  schedule2: MaintenanceSchedule;
  conflictType: string;
}

export interface ScheduleStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  byPriority: { critical: number; high: number; medium: number; low: number };
  completionRate: number;
}

export interface OptimizationDashboard {
  configurations: OptimizerConfiguration[];
  results: OptimizationResult[];
  trendInsights: unknown[];
  equipment: unknown[];
  vessels: unknown[];
  sectionErrors?: Record<string, string>;
}
