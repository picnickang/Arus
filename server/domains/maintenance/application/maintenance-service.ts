/**
 * Maintenance Application - Application Service
 * Orchestrates domain logic using ports (interfaces)
 * This is the "hexagonal core" - it knows nothing about infrastructure
 */

import type {
  IMaintenanceScheduleRepository,
  IMaintenanceTemplateRepository,
  IEventPublisher,
} from "../domain/ports";
import type {
  MaintenanceScheduleEntity,
  MaintenanceTemplateEntity,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CreateTemplateCommand,
  UpdateTemplateCommand,
} from "../domain/types";
import type {
  MaintenanceScheduleCreatedEvent,
  MaintenanceScheduleUpdatedEvent,
  MaintenanceScheduleDeletedEvent,
  MaintenanceAutoScheduledEvent,
  MaintenanceTemplateCreatedEvent,
  MaintenanceTemplateUpdatedEvent,
  MaintenanceTemplateDeletedEvent,
} from "../domain/events";
import { createEventId } from "../domain/events";

/**
 * Application service for maintenance domain
 * Uses dependency injection for all infrastructure concerns
 */
export class MaintenanceApplicationService {
  constructor(
    private readonly scheduleRepository: IMaintenanceScheduleRepository,
    private readonly templateRepository: IMaintenanceTemplateRepository,
    private readonly eventPublisher: IEventPublisher
  ) {}

  // ========== Maintenance Schedules ==========

  async listSchedules(
    orgId: string,
    equipmentId?: string,
    status?: string,
  ): Promise<MaintenanceScheduleEntity[]> {
    return this.scheduleRepository.findAll(orgId, equipmentId, status);
  }

  async getScheduleById(id: string, orgId: string): Promise<MaintenanceScheduleEntity | undefined> {
    return this.scheduleRepository.findById(id, orgId);
  }

  async createSchedule(
    command: CreateScheduleCommand,
    userId?: string
  ): Promise<MaintenanceScheduleEntity> {
    const schedule = await this.scheduleRepository.create(command);

    const event: MaintenanceScheduleCreatedEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceScheduleCreated",
      aggregateId: schedule.id,
      aggregateType: "MaintenanceSchedule",
      occurredAt: new Date(),
      userId,
      orgId: schedule.orgId,
      version: 1,
      payload: {
        equipmentId: schedule.equipmentId,
        scheduledDate: schedule.scheduledDate,
        maintenanceType: schedule.maintenanceType,
        priority: schedule.priority,
      },
    };

    await this.eventPublisher.publish(event);

    return schedule;
  }

  async updateSchedule(
    id: string,
    updates: UpdateScheduleCommand,
    orgId: string,
    userId?: string
  ): Promise<MaintenanceScheduleEntity> {
    const previousSchedule = await this.scheduleRepository.findById(id, orgId);

    if (!previousSchedule) {
      throw new Error(`Schedule ${id} not found in org ${orgId}`);
    }

    const schedule = await this.scheduleRepository.update(id, updates);

    const changedFields = Object.keys(updates).filter(
      (key) => updates[key as keyof UpdateScheduleCommand] !== undefined
    );

    const event: MaintenanceScheduleUpdatedEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceScheduleUpdated",
      aggregateId: schedule.id,
      aggregateType: "MaintenanceSchedule",
      occurredAt: new Date(),
      userId,
      orgId,
      version: 1,
      payload: {
        previousState: { ...previousSchedule } as Record<string, unknown>,
        newState: { ...schedule } as Record<string, unknown>,
        changedFields,
      },
    };

    await this.eventPublisher.publish(event);

    return schedule;
  }

  async deleteSchedule(id: string, orgId: string, userId?: string): Promise<void> {
    const schedule = await this.scheduleRepository.findById(id, orgId);

    if (!schedule) {
      throw new Error(`Schedule ${id} not found in org ${orgId}`);
    }

    await this.scheduleRepository.delete(id);

    const event: MaintenanceScheduleDeletedEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceScheduleDeleted",
      aggregateId: id,
      aggregateType: "MaintenanceSchedule",
      occurredAt: new Date(),
      userId,
      orgId,
      version: 1,
      payload: {
        equipmentId: schedule.equipmentId,
        scheduledDate: schedule.scheduledDate,
      },
    };

    await this.eventPublisher.publish(event);
  }

  async getUpcomingSchedules(
    orgId: string,
    daysAhead: number = 30
  ): Promise<MaintenanceScheduleEntity[]> {
    return this.scheduleRepository.findUpcoming(orgId, daysAhead);
  }

  async autoScheduleForEquipment(
    equipmentId: string,
    pdmScore: number,
    userId?: string
  ): Promise<MaintenanceScheduleEntity> {
    const schedule = await this.scheduleRepository.autoScheduleForEquipment(equipmentId, pdmScore);

    const event: MaintenanceAutoScheduledEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceAutoScheduled",
      aggregateId: schedule.id,
      aggregateType: "MaintenanceSchedule",
      occurredAt: new Date(),
      userId,
      orgId: schedule.orgId,
      version: 1,
      payload: {
        equipmentId: schedule.equipmentId,
        scheduledDate: schedule.scheduledDate,
        pdmScore,
        triggerSource: "pdm_prediction",
      },
    };

    await this.eventPublisher.publish(event);

    return schedule;
  }

  // ========== Maintenance Templates ==========

  async listTemplates(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplateEntity[]> {
    return this.templateRepository.findAll(orgId, equipmentType, isActive);
  }

  async getTemplateById(id: string, orgId: string): Promise<MaintenanceTemplateEntity | undefined> {
    return this.templateRepository.findById(id, orgId);
  }

  async createTemplate(
    command: CreateTemplateCommand,
    userId?: string
  ): Promise<MaintenanceTemplateEntity> {
    const template = await this.templateRepository.create(command);

    const event: MaintenanceTemplateCreatedEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceTemplateCreated",
      aggregateId: template.id,
      aggregateType: "MaintenanceTemplate",
      occurredAt: new Date(),
      userId,
      orgId: template.orgId,
      version: 1,
      payload: {
        name: template.name,
        equipmentType: template.equipmentType,
        maintenanceType: template.maintenanceType,
      },
    };

    await this.eventPublisher.publish(event);

    return template;
  }

  async updateTemplate(
    id: string,
    updates: UpdateTemplateCommand,
    orgId: string,
    userId?: string
  ): Promise<MaintenanceTemplateEntity> {
    const previousTemplate = await this.templateRepository.findById(id, orgId);
    const template = await this.templateRepository.update(id, updates, orgId);

    const changedFields = Object.keys(updates).filter(
      (key) => updates[key as keyof UpdateTemplateCommand] !== undefined
    );

    const event: MaintenanceTemplateUpdatedEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceTemplateUpdated",
      aggregateId: template.id,
      aggregateType: "MaintenanceTemplate",
      occurredAt: new Date(),
      userId,
      orgId: template.orgId,
      version: 1,
      payload: {
        previousState: { ...previousTemplate } as Record<string, unknown>,
        newState: { ...template } as Record<string, unknown>,
        changedFields,
      },
    };

    await this.eventPublisher.publish(event);

    return template;
  }

  async deleteTemplate(id: string, orgId: string, userId?: string): Promise<void> {
    const template = await this.templateRepository.findById(id, orgId);

    if (!template) {
      throw new Error(`Template ${id} not found in org ${orgId}`);
    }

    await this.templateRepository.delete(id, orgId);

    const event: MaintenanceTemplateDeletedEvent = {
      eventId: createEventId(),
      eventType: "MaintenanceTemplateDeleted",
      aggregateId: id,
      aggregateType: "MaintenanceTemplate",
      occurredAt: new Date(),
      userId,
      orgId,
      version: 1,
      payload: {
        name: template.name,
        equipmentType: template.equipmentType,
      },
    };

    await this.eventPublisher.publish(event);
  }
}
