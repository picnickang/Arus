/**
 * Maintenance Infrastructure - Schedule Repository Adapter
 * Implements IMaintenanceScheduleRepository port using storage layer
 */

import type { IMaintenanceScheduleRepository } from '../domain/ports';
import type {
  MaintenanceScheduleEntity,
  CreateScheduleCommand,
  UpdateScheduleCommand,
} from '../domain/types';
import { storage } from '../../../storage';

/**
 * PostgreSQL/Storage adapter for MaintenanceScheduleRepository
 */
export class MaintenanceScheduleRepositoryAdapter implements IMaintenanceScheduleRepository {
  async findAll(equipmentId?: string, status?: string): Promise<MaintenanceScheduleEntity[]> {
    const schedules = await storage.getMaintenanceSchedules(equipmentId, status);
    return schedules.map(this.mapToEntity);
  }

  async findById(id: string, orgId?: string): Promise<MaintenanceScheduleEntity | undefined> {
    const schedules = await storage.getMaintenanceSchedules();
    const schedule = schedules.find((s) => s.id === id);

    if (schedule && orgId && schedule.orgId !== orgId) {
      return undefined;
    }

    return schedule ? this.mapToEntity(schedule) : undefined;
  }

  async findUpcoming(orgId: string, daysAhead: number): Promise<MaintenanceScheduleEntity[]> {
    const schedules = await storage.getMaintenanceSchedules(undefined, 'scheduled');
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return schedules
      .filter((s) => s.orgId === orgId && s.scheduledDate >= now && s.scheduledDate <= futureDate)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      .map(this.mapToEntity);
  }

  async create(command: CreateScheduleCommand): Promise<MaintenanceScheduleEntity> {
    const schedule = await storage.createMaintenanceSchedule(command as any);
    return this.mapToEntity(schedule);
  }

  async update(id: string, updates: UpdateScheduleCommand): Promise<MaintenanceScheduleEntity> {
    const schedule = await storage.updateMaintenanceSchedule(id, updates as any);
    return this.mapToEntity(schedule);
  }

  async delete(id: string): Promise<void> {
    await storage.deleteMaintenanceSchedule(id);
  }

  async autoScheduleForEquipment(equipmentId: string, pdmScore: number): Promise<MaintenanceScheduleEntity> {
    const schedule = await storage.autoScheduleMaintenance(equipmentId, pdmScore);
    return this.mapToEntity(schedule);
  }

  private mapToEntity(schedule: any): MaintenanceScheduleEntity {
    return {
      id: schedule.id,
      orgId: schedule.orgId,
      equipmentId: schedule.equipmentId,
      scheduledDate: schedule.scheduledDate,
      status: schedule.status || 'scheduled',
      priority: schedule.priority || 'medium',
      maintenanceType: schedule.maintenanceType,
      description: schedule.description,
      estimatedDuration: schedule.estimatedDuration,
      assignedTo: schedule.assignedTo,
      completedAt: schedule.completedAt,
      completedBy: schedule.completedBy,
      notes: schedule.notes,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }
}

export const maintenanceScheduleRepository = new MaintenanceScheduleRepositoryAdapter();
