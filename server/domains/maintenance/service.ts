/**
 * Maintenance Service - Backward Compatibility Shim
 *
 * This file maintains backward compatibility with existing code
 * while delegating to the new hexagonal application service.
 *
 * Migration path:
 * 1. New code should import from './application'
 * 2. This shim will be deprecated once all consumers migrate
 */

import type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  MaintenanceTemplate,
  InsertMaintenanceTemplate,
} from "@shared/schema";
import { maintenanceAppService } from "./application";

/**
 * Maintenance Service (Legacy API)
 * Wraps the new hexagonal application service for backward compatibility
 */
export class MaintenanceService {
  // ========== Maintenance Schedules ==========

  async listSchedules(equipmentId?: string, status?: string): Promise<MaintenanceSchedule[]> {
    const entities = await maintenanceAppService.listSchedules(equipmentId, status);
    return entities as unknown as MaintenanceSchedule[];
  }

  async getScheduleById(id: string, orgId: string): Promise<MaintenanceSchedule | undefined> {
    const entity = await maintenanceAppService.getScheduleById(id, orgId);
    return entity as unknown as MaintenanceSchedule | undefined;
  }

  async createSchedule(
    data: InsertMaintenanceSchedule,
    userId?: string
  ): Promise<MaintenanceSchedule> {
    const entity = await maintenanceAppService.createSchedule(
      {
        orgId: data.orgId,
        equipmentId: data.equipmentId,
        scheduledDate: data.scheduledDate,
        status: data.status as any,
        priority: data.priority as any,
        maintenanceType: data.maintenanceType as any,
        description: data.description ?? undefined,
        estimatedDuration: (data as any).estimatedDurationHours,
        assignedTo: data.assignedTo ?? undefined,
      } as any,
      userId
    );
    return entity as unknown as MaintenanceSchedule;
  }

  async updateSchedule(
    id: string,
    data: Partial<InsertMaintenanceSchedule>,
    orgId: string,
    userId?: string
  ): Promise<MaintenanceSchedule> {
    const entity = await maintenanceAppService.updateSchedule(
      id,
      {
        scheduledDate: data.scheduledDate,
        status: data.status as any,
        priority: data.priority as any,
        maintenanceType: data.maintenanceType as any,
        description: data.description ?? undefined,
        estimatedDuration: (data as any).estimatedDurationHours,
        assignedTo: data.assignedTo ?? undefined,
        notes: (data as any).notes,
      } as any,
      orgId,
      userId
    );
    return entity as unknown as MaintenanceSchedule;
  }

  async deleteSchedule(id: string, orgId: string, userId?: string): Promise<void> {
    await maintenanceAppService.deleteSchedule(id, orgId, userId);
  }

  async getUpcomingSchedules(
    orgId: string,
    daysAhead: number = 30
  ): Promise<MaintenanceSchedule[]> {
    const entities = await maintenanceAppService.getUpcomingSchedules(orgId, daysAhead);
    return entities as unknown as MaintenanceSchedule[];
  }

  async autoScheduleForEquipment(
    equipmentId: string,
    pdmScore: number,
    userId?: string
  ): Promise<MaintenanceSchedule> {
    const entity = await maintenanceAppService.autoScheduleForEquipment(
      equipmentId,
      pdmScore,
      userId
    );
    return entity as unknown as MaintenanceSchedule;
  }

  // ========== Maintenance Templates ==========

  async listTemplates(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplate[]> {
    const entities = await maintenanceAppService.listTemplates(orgId, equipmentType, isActive);
    return entities as unknown as MaintenanceTemplate[];
  }

  async getTemplateById(id: string, orgId: string): Promise<MaintenanceTemplate | undefined> {
    const entity = await maintenanceAppService.getTemplateById(id, orgId);
    return entity as unknown as MaintenanceTemplate | undefined;
  }

  async createTemplate(
    data: InsertMaintenanceTemplate,
    userId?: string
  ): Promise<MaintenanceTemplate> {
    const entity = await maintenanceAppService.createTemplate(
      {
        orgId: data.orgId,
        name: data.name,
        equipmentType: data.equipmentType,
        maintenanceType: data.maintenanceType as any,
        description: data.description ?? undefined,
        estimatedDuration: (data as any).estimatedDurationHours,
        requiredParts: data.requiredParts as string[],
        checklistItems: data.checklistItems as string[],
        intervalDays: data.intervalDays ?? undefined,
        intervalHours: data.intervalHours ?? undefined,
        isActive: data.isActive ?? undefined,
      } as any,
      userId
    );
    return entity as unknown as MaintenanceTemplate;
  }

  async updateTemplate(
    id: string,
    data: Partial<InsertMaintenanceTemplate>,
    orgId: string,
    userId?: string
  ): Promise<MaintenanceTemplate> {
    const entity = await maintenanceAppService.updateTemplate(
      id,
      {
        name: data.name,
        equipmentType: data.equipmentType,
        maintenanceType: data.maintenanceType as any,
        description: data.description ?? undefined,
        estimatedDuration: (data as any).estimatedDurationHours,
        requiredParts: data.requiredParts as string[],
        checklistItems: data.checklistItems as string[],
        intervalDays: data.intervalDays ?? undefined,
        intervalHours: data.intervalHours ?? undefined,
        isActive: data.isActive ?? undefined,
      } as any,
      orgId,
      userId
    );
    return entity as unknown as MaintenanceTemplate;
  }

  async deleteTemplate(id: string, orgId: string, userId?: string): Promise<void> {
    await maintenanceAppService.deleteTemplate(id, orgId, userId);
  }
}

export const maintenanceService = new MaintenanceService();
