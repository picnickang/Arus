/**
 * Maintenance Infrastructure - Template Repository Adapter
 * Implements IMaintenanceTemplateRepository port using storage layer
 */

import type { IMaintenanceTemplateRepository } from '../domain/ports';
import type {
  MaintenanceTemplateEntity,
  CreateTemplateCommand,
  UpdateTemplateCommand,
} from '../domain/types';
import { storage } from '../../../storage';

/**
 * PostgreSQL/Storage adapter for MaintenanceTemplateRepository
 */
export class MaintenanceTemplateRepositoryAdapter implements IMaintenanceTemplateRepository {
  async findAll(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplateEntity[]> {
    const templates = await storage.getMaintenanceTemplates(orgId, equipmentType, isActive);
    return templates.map(this.mapToEntity);
  }

  async findById(id: string, orgId?: string): Promise<MaintenanceTemplateEntity | undefined> {
    const template = await storage.getMaintenanceTemplate(id, orgId);
    return template ? this.mapToEntity(template) : undefined;
  }

  async create(command: CreateTemplateCommand): Promise<MaintenanceTemplateEntity> {
    const template = await storage.createMaintenanceTemplate(command as any);
    return this.mapToEntity(template);
  }

  async update(
    id: string,
    updates: UpdateTemplateCommand,
    orgId?: string
  ): Promise<MaintenanceTemplateEntity> {
    const template = await storage.updateMaintenanceTemplate(id, updates as any, orgId);
    return this.mapToEntity(template);
  }

  async delete(id: string, orgId?: string): Promise<void> {
    await storage.deleteMaintenanceTemplate(id, orgId);
  }

  private mapToEntity(template: any): MaintenanceTemplateEntity {
    return {
      id: template.id,
      orgId: template.orgId,
      name: template.name,
      equipmentType: template.equipmentType,
      maintenanceType: template.maintenanceType,
      description: template.description,
      estimatedDuration: template.estimatedDuration,
      requiredParts: template.requiredParts,
      checklistItems: template.checklistItems,
      intervalDays: template.intervalDays,
      intervalHours: template.intervalHours,
      isActive: template.isActive ?? true,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

export const maintenanceTemplateRepository = new MaintenanceTemplateRepositoryAdapter();
