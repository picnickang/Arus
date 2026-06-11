/**
 * Maintenance Infrastructure - Template Repository Adapter
 * Implements IMaintenanceTemplateRepository port using storage layer
 */

import type { IMaintenanceTemplateRepository } from "../domain/ports";
import type {
  MaintenanceTemplateEntity,
  CreateTemplateCommand,
  UpdateTemplateCommand,
} from "../domain/types";
import { dbMaintenanceTemplatesStorage } from "../../../repositories";

/**
 * PostgreSQL/Storage adapter for MaintenanceTemplateRepository
 */
export class MaintenanceTemplateRepositoryAdapter implements IMaintenanceTemplateRepository {
  async findAll(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplateEntity[]> {
    const templates = await dbMaintenanceTemplatesStorage.getMaintenanceTemplates(
      orgId,
      equipmentType,
      isActive
    );
    return templates.map(this.mapToEntity);
  }

  async findById(id: string, orgId?: string): Promise<MaintenanceTemplateEntity | undefined> {
    const template = await dbMaintenanceTemplatesStorage.getMaintenanceTemplate(id, orgId);
    return template ? this.mapToEntity(template) : undefined;
  }

  async create(command: CreateTemplateCommand): Promise<MaintenanceTemplateEntity> {
    const template = await dbMaintenanceTemplatesStorage.createMaintenanceTemplate(
      command as object as Parameters<
        typeof dbMaintenanceTemplatesStorage.createMaintenanceTemplate
      >[0]
    );
    return this.mapToEntity(template);
  }

  async update(
    id: string,
    updates: UpdateTemplateCommand,
    orgId?: string
  ): Promise<MaintenanceTemplateEntity> {
    const template = await dbMaintenanceTemplatesStorage.updateMaintenanceTemplate(
      id,
      updates as object as Parameters<
        typeof dbMaintenanceTemplatesStorage.updateMaintenanceTemplate
      >[1],
      orgId
    );
    return this.mapToEntity(template);
  }

  async delete(id: string, orgId?: string): Promise<void> {
    await dbMaintenanceTemplatesStorage.deleteMaintenanceTemplate(id, orgId);
  }

  private mapToEntity(template: Record<string, unknown>): MaintenanceTemplateEntity {
    const t = template as {
      id: string;
      orgId?: string;
      name: string;
      equipmentType: string;
      maintenanceType: string;
      description?: string | null;
      estimatedDurationHours?: number | null;
      requiredParts?: unknown;
      checklistItems?: unknown;
      intervalDays?: number | null;
      intervalHours?: number | null;
      isActive?: boolean | null;
      createdAt?: Date | null;
      updatedAt?: Date | null;
    };
    return {
      id: t.id,
      orgId: t.orgId ?? "",
      name: t.name,
      equipmentType: t.equipmentType,
      maintenanceType: t.maintenanceType,
      description: t.description ?? undefined,
      estimatedDuration: t.estimatedDurationHours ?? undefined,
      requiredParts: t.requiredParts as MaintenanceTemplateEntity["requiredParts"],
      checklistItems: t.checklistItems as MaintenanceTemplateEntity["checklistItems"],
      intervalDays: t.intervalDays ?? undefined,
      intervalHours: t.intervalHours ?? undefined,
      isActive: t.isActive ?? true,
      createdAt: t.createdAt ?? undefined,
      updatedAt: t.updatedAt ?? undefined,
    };
  }
}

export const maintenanceTemplateRepository = new MaintenanceTemplateRepositoryAdapter();
