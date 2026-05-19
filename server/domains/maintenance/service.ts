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
import type {
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CreateTemplateCommand,
  UpdateTemplateCommand,
} from "./domain/types";

/**
 * Legacy insert shapes occasionally carried an `estimatedDurationHours` /
 * `notes` field that the hexagonal domain models as `estimatedDuration` /
 * `notes`. These helpers narrow the legacy payload without `any` casts.
 */
type LegacyScheduleExtras = {
  estimatedDurationHours?: number;
  notes?: string;
};
type LegacyTemplateExtras = {
  estimatedDurationHours?: number;
};

function pickLegacyScheduleExtras(
  data: Partial<InsertMaintenanceSchedule>,
): LegacyScheduleExtras {
  const record = data as Record<string, unknown>;
  return {
    estimatedDurationHours:
      typeof record.estimatedDurationHours === "number"
        ? record.estimatedDurationHours
        : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
  };
}

function pickLegacyTemplateExtras(
  data: Partial<InsertMaintenanceTemplate>,
): LegacyTemplateExtras {
  const record = data as Record<string, unknown>;
  return {
    estimatedDurationHours:
      typeof record.estimatedDurationHours === "number"
        ? record.estimatedDurationHours
        : undefined,
  };
}

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
    const extras = pickLegacyScheduleExtras(data);
    const command: CreateScheduleCommand = {
      orgId: data.orgId,
      equipmentId: data.equipmentId,
      scheduledDate: data.scheduledDate,
      status: data.status ?? undefined,
      priority: data.priority != null ? String(data.priority) : undefined,
      maintenanceType: data.maintenanceType,
      description: data.description ?? undefined,
      estimatedDuration: extras.estimatedDurationHours,
      assignedTo: data.assignedTo ?? undefined,
    };
    const entity = await maintenanceAppService.createSchedule(command, userId);
    return entity as unknown as MaintenanceSchedule;
  }

  async updateSchedule(
    id: string,
    data: Partial<InsertMaintenanceSchedule>,
    orgId: string,
    userId?: string
  ): Promise<MaintenanceSchedule> {
    const extras = pickLegacyScheduleExtras(data);
    const command: UpdateScheduleCommand = {
      scheduledDate: data.scheduledDate,
      status: data.status ?? undefined,
      priority: data.priority != null ? String(data.priority) : undefined,
      maintenanceType: data.maintenanceType ?? undefined,
      description: data.description ?? undefined,
      estimatedDuration: extras.estimatedDurationHours,
      assignedTo: data.assignedTo ?? undefined,
      notes: extras.notes,
    };
    const entity = await maintenanceAppService.updateSchedule(id, command, orgId, userId);
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
    const extras = pickLegacyTemplateExtras(data);
    const command: CreateTemplateCommand = {
      orgId: data.orgId,
      name: data.name,
      equipmentType: data.equipmentType ?? undefined,
      maintenanceType: data.maintenanceType,
      description: data.description ?? undefined,
      estimatedDuration: extras.estimatedDurationHours,
      requiredParts: (data.requiredParts as string[] | null | undefined) ?? undefined,
      checklistItems: (data.checklistItems as string[] | null | undefined) ?? undefined,
      intervalDays: data.intervalDays ?? undefined,
      intervalHours:
        data.intervalHours != null && data.intervalHours !== ""
          ? Number(data.intervalHours)
          : undefined,
      isActive: data.isActive ?? undefined,
    };
    const entity = await maintenanceAppService.createTemplate(command, userId);
    return entity as unknown as MaintenanceTemplate;
  }

  async updateTemplate(
    id: string,
    data: Partial<InsertMaintenanceTemplate>,
    orgId: string,
    userId?: string
  ): Promise<MaintenanceTemplate> {
    const extras = pickLegacyTemplateExtras(data);
    const command: UpdateTemplateCommand = {
      name: data.name ?? undefined,
      equipmentType: data.equipmentType ?? undefined,
      maintenanceType: data.maintenanceType ?? undefined,
      description: data.description ?? undefined,
      estimatedDuration: extras.estimatedDurationHours,
      requiredParts: (data.requiredParts as string[] | null | undefined) ?? undefined,
      checklistItems: (data.checklistItems as string[] | null | undefined) ?? undefined,
      intervalDays: data.intervalDays ?? undefined,
      intervalHours:
        data.intervalHours != null && data.intervalHours !== ""
          ? Number(data.intervalHours)
          : undefined,
      isActive: data.isActive ?? undefined,
    };
    const entity = await maintenanceAppService.updateTemplate(id, command, orgId, userId);
    return entity as unknown as MaintenanceTemplate;
  }

  async deleteTemplate(id: string, orgId: string, userId?: string): Promise<void> {
    await maintenanceAppService.deleteTemplate(id, orgId, userId);
  }
}

export const maintenanceService = new MaintenanceService();
