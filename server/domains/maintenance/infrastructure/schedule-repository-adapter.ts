/**
 * Maintenance Infrastructure - Schedule Repository Adapter
 * Implements IMaintenanceScheduleRepository port using storage layer
 */

import type { IMaintenanceScheduleRepository } from "../domain/ports";
import type {
  MaintenanceScheduleEntity,
  CreateScheduleCommand,
  UpdateScheduleCommand,
} from "../domain/types";
import { dbMaintenanceStorage, schedulingAdapter } from "../../../repositories";

/**
 * PostgreSQL/Storage adapter for MaintenanceScheduleRepository
 */
export class MaintenanceScheduleRepositoryAdapter implements IMaintenanceScheduleRepository {
  async findAll(equipmentId?: string, status?: string): Promise<MaintenanceScheduleEntity[]> {
    const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(equipmentId, status);
    return schedules.map(this.mapToEntity);
  }

  async findById(id: string, orgId?: string): Promise<MaintenanceScheduleEntity | undefined> {
    const schedules = await dbMaintenanceStorage.getMaintenanceSchedules();
    const schedule = schedules.find((s) => s.id === id);

    if (schedule && orgId && schedule.orgId !== orgId) {
      return undefined;
    }

    return schedule ? this.mapToEntity(schedule) : undefined;
  }

  async findUpcoming(orgId: string, daysAhead: number): Promise<MaintenanceScheduleEntity[]> {
    const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(undefined, "scheduled");
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return schedules
      .filter(
        (s) => s.orgId === orgId && s.scheduledDate >= now && s.scheduledDate <= futureDate
      )
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      .map(this.mapToEntity);
  }

  async create(command: CreateScheduleCommand): Promise<MaintenanceScheduleEntity> {
    const schedule = await dbMaintenanceStorage.createMaintenanceSchedule(
      command as object as Parameters<typeof dbMaintenanceStorage.createMaintenanceSchedule>[0]
    );
    return this.mapToEntity(schedule);
  }

  async update(id: string, updates: UpdateScheduleCommand): Promise<MaintenanceScheduleEntity> {
    const schedule = await dbMaintenanceStorage.updateMaintenanceSchedule(
      id,
      updates as object as Parameters<typeof dbMaintenanceStorage.updateMaintenanceSchedule>[1]
    );
    return this.mapToEntity(schedule);
  }

  async delete(id: string): Promise<void> {
    await dbMaintenanceStorage.deleteMaintenanceSchedule(id);
  }

  async autoScheduleForEquipment(
    equipmentId: string,
    pdmScore: number
  ): Promise<MaintenanceScheduleEntity> {
    const schedule = await schedulingAdapter.autoScheduleMaintenance(equipmentId, pdmScore);
    return this.mapToEntity(schedule);
  }

  private mapToEntity(schedule: Record<string, unknown> | null | undefined): MaintenanceScheduleEntity {
    const s = (schedule ?? {}) as {
      id: string; orgId?: string; equipmentId: string;
      scheduledDate: Date; status?: string | null; priority?: string | null;
      maintenanceType: string; description?: string | null;
      estimatedDurationHours?: number | null;
      assignedTo?: string | null;
      completedAt?: Date | null; completedBy?: string | null;
      notes?: string | null;
      createdAt?: Date | null; updatedAt?: Date | null;
    };
    return {
      id: s.id,
      orgId: s.orgId ?? "",
      equipmentId: s.equipmentId,
      scheduledDate: s.scheduledDate,
      status: (s.status as MaintenanceScheduleEntity["status"]) || "scheduled",
      priority: (s.priority as MaintenanceScheduleEntity["priority"]) || "medium",
      maintenanceType: s.maintenanceType,
      description: s.description ?? undefined,
      estimatedDuration: s.estimatedDurationHours ?? undefined,
      assignedTo: s.assignedTo ?? undefined,
      completedAt: s.completedAt ?? undefined,
      completedBy: s.completedBy ?? undefined,
      notes: s.notes ?? undefined,
      createdAt: s.createdAt ?? undefined,
      updatedAt: s.updatedAt ?? undefined,
    };
  }
}

export const maintenanceScheduleRepository = new MaintenanceScheduleRepositoryAdapter();
