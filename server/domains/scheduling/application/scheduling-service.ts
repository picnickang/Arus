/**
 * Scheduling Application Service
 *
 * Maintenance-schedule and optimization use-cases over injected ports
 * (constructor DI). Conflict detection, calendar grouping, stats, upcoming, and
 * the optimization-dashboard aggregation live here rather than in the routes.
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import { loadSections } from "../../../lib/aggregate-helpers";
import type {
  ISchedulingMaintenancePort,
  IOptimizerRepository,
  IOptimizationDirectoryPort,
} from "../domain/ports";
import type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  OptimizerConfiguration,
  OptimizationResult,
  ScheduleQueryFilters,
  ScheduleConflict,
  ScheduleStats,
  OptimizationDashboard,
} from "../domain/types";

function scheduleField(schedule: MaintenanceSchedule, field: string): unknown {
  return Reflect.get(schedule, field);
}

export class SchedulingService {
  constructor(
    private readonly maintenance: ISchedulingMaintenancePort,
    private readonly optimizer: IOptimizerRepository,
    private readonly directory: IOptimizationDirectoryPort
  ) {}

  // ===== Maintenance schedules =====

  listSchedules(
    orgId: string,
    opts: { equipmentId?: string | undefined } & ScheduleQueryFilters
  ): Promise<MaintenanceSchedule[]> {
    const { equipmentId, ...filters } = opts;
    return this.maintenance.getMaintenanceSchedules(equipmentId, orgId, filters);
  }

  getSchedule(id: string, orgId: string): Promise<MaintenanceSchedule | undefined> {
    return this.maintenance.getMaintenanceSchedule(id, orgId);
  }

  createSchedule(data: InsertMaintenanceSchedule): Promise<MaintenanceSchedule> {
    return this.maintenance.createMaintenanceSchedule(data);
  }

  updateSchedule(
    id: string,
    updates: WidenPartial<InsertMaintenanceSchedule>,
    orgId: string
  ): Promise<MaintenanceSchedule> {
    return this.maintenance.updateMaintenanceSchedule(id, updates, orgId);
  }

  deleteSchedule(id: string, orgId: string): Promise<void> {
    return this.maintenance.deleteMaintenanceSchedule(id, orgId);
  }

  createBulkSchedules(schedules: InsertMaintenanceSchedule[]): Promise<MaintenanceSchedule[]> {
    return Promise.all(schedules.map((s) => this.maintenance.createMaintenanceSchedule(s)));
  }

  async detectConflicts(orgId: string, filters: ScheduleQueryFilters): Promise<ScheduleConflict[]> {
    const schedules = await this.maintenance.getMaintenanceSchedules(undefined, orgId, filters);
    const conflicts: ScheduleConflict[] = [];
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];
        if (!s1 || !s2) {
          continue;
        }
        if (
          s1.scheduledDate === s2.scheduledDate &&
          scheduleField(s1, "assignedCrewId") === scheduleField(s2, "assignedCrewId")
        ) {
          conflicts.push({ schedule1: s1, schedule2: s2, conflictType: "crew_overlap" });
        }
      }
    }
    return conflicts;
  }

  async getCalendar(
    orgId: string,
    opts: { vesselId?: string | undefined; month?: number | undefined; year?: number | undefined }
  ): Promise<Record<string, MaintenanceSchedule[]>> {
    const targetMonth = opts.month ?? new Date().getMonth();
    const targetYear = opts.year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    const schedules = await this.maintenance.getMaintenanceSchedules(undefined, orgId, {
      vesselId: opts.vesselId,
      startDate,
      endDate,
    });

    const calendarData: Record<string, MaintenanceSchedule[]> = {};
    schedules.forEach((schedule) => {
      const dateKey = new Date(schedule.scheduledDate).toISOString().split("T")[0] ?? "";
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = [];
      }
      calendarData[dateKey]?.push(schedule);
    });
    return calendarData;
  }

  async getStats(
    orgId: string,
    opts: { vesselId?: string | undefined; months?: number | undefined }
  ): Promise<ScheduleStats> {
    const monthsNum = opts.months ?? 3;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);

    const schedules = await this.maintenance.getMaintenanceSchedules(undefined, orgId, {
      vesselId: opts.vesselId,
      startDate: cutoffDate,
    });

    const isPriority = (s: MaintenanceSchedule, name: string) =>
      String(scheduleField(s, "priority") ?? "") === name;
    const completed = schedules.filter((s) => scheduleField(s, "status") === "completed").length;
    return {
      total: schedules.length,
      completed,
      pending: schedules.filter((s) => scheduleField(s, "status") === "pending").length,
      overdue: schedules.filter((s) => {
        const dueDate = new Date(s.scheduledDate);
        return scheduleField(s, "status") !== "completed" && dueDate < new Date();
      }).length,
      byPriority: {
        critical: schedules.filter((s) => isPriority(s, "critical")).length,
        high: schedules.filter((s) => isPriority(s, "high")).length,
        medium: schedules.filter((s) => isPriority(s, "medium")).length,
        low: schedules.filter((s) => isPriority(s, "low")).length,
      },
      completionRate: schedules.length > 0 ? (completed / schedules.length) * 100 : 0,
    };
  }

  async getUpcoming(
    orgId: string,
    opts: { vesselId?: string | undefined; days?: number | undefined; limit?: number | undefined }
  ): Promise<MaintenanceSchedule[]> {
    const daysNum = opts.days ?? 30;
    const limitNum = opts.limit ?? 50;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysNum);

    const schedules = await this.maintenance.getMaintenanceSchedules(undefined, orgId, {
      vesselId: opts.vesselId,
      status: "pending",
      startDate: new Date(),
      endDate,
    });

    return schedules
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, limitNum);
  }

  // ===== Optimization =====

  listOptimizerConfigurations(orgId: string): Promise<OptimizerConfiguration[]> {
    return this.optimizer.getOptimizerConfigurations(orgId);
  }

  createOptimizerConfiguration(
    ...args: Parameters<IOptimizerRepository["createOptimizerConfiguration"]>
  ): Promise<OptimizerConfiguration> {
    return this.optimizer.createOptimizerConfiguration(...args);
  }

  listOptimizationResults(orgId: string, from?: Date, to?: Date): Promise<OptimizationResult[]> {
    return this.optimizer.getOptimizationResults(orgId, from, to);
  }

  createOptimizationResult(
    ...args: Parameters<IOptimizerRepository["createOptimizationResult"]>
  ): Promise<OptimizationResult> {
    return this.optimizer.createOptimizationResult(...args);
  }

  async getOptimizationDashboard(orgId: string): Promise<OptimizationDashboard> {
    // Collapses the page's parallel configurations/results/equipment/vessels
    // fetches into one request, reusing the same storage/directory calls as the
    // individual routes. trendInsights is reserved (the per-resource endpoint
    // never existed; the client always fell back to []).
    const { sections, sectionErrors } = await loadSections(
      {
        configurations: () => this.optimizer.getOptimizerConfigurations(orgId),
        results: () => this.optimizer.getOptimizationResults(orgId),
        equipment: () => this.directory.listEquipmentRegistry(orgId),
        vessels: () => this.directory.listVessels(orgId),
      },
      "GET /api/optimization/dashboard"
    );

    return {
      configurations: sections.configurations ?? [],
      results: sections.results ?? [],
      trendInsights: [],
      equipment: sections.equipment ?? [],
      vessels: sections.vessels ?? [],
      ...(Object.keys(sectionErrors).length > 0 ? { sectionErrors } : {}),
    };
  }

  async runOptimization(
    orgId: string,
    configId: string,
    targetDate?: string
  ): Promise<OptimizationResult> {
    const schedules = await this.maintenance.getMaintenanceSchedules(undefined, orgId, {
      startDate: new Date(),
      endDate: targetDate ? new Date(targetDate) : undefined,
    });

    const optimizedSchedules = schedules.map((s, index: number) => ({
      ...s,
      optimizedScore: (index % 10) * 10 + 5,
      suggestedDate: s.scheduledDate,
      suggestedCrew: scheduleField(s, "assignedCrewId"),
    }));

    return this.optimizer.createOptimizationResult({
      configurationId: configId,
      orgId,
      inputSchedules: schedules.length,
      outputSchedules: optimizedSchedules.length,
      improvementScore: 15.5,
      runStatus: "completed",
      results: optimizedSchedules,
    } as Parameters<IOptimizerRepository["createOptimizationResult"]>[0]);
  }
}
