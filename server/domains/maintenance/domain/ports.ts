/**
 * Maintenance Domain - Ports (Interfaces)
 * Define contracts for infrastructure adapters
 */

import type {
  MaintenanceScheduleEntity,
  MaintenanceTemplateEntity,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  CreateTemplateCommand,
  UpdateTemplateCommand,
} from './types';
import type { MaintenanceDomainEvent } from './events';

/**
 * Port for maintenance schedule persistence
 */
export interface IMaintenanceScheduleRepository {
  findAll(equipmentId?: string, status?: string): Promise<MaintenanceScheduleEntity[]>;
  findById(id: string, orgId?: string): Promise<MaintenanceScheduleEntity | undefined>;
  findUpcoming(orgId: string, daysAhead: number): Promise<MaintenanceScheduleEntity[]>;
  create(schedule: CreateScheduleCommand): Promise<MaintenanceScheduleEntity>;
  update(id: string, updates: UpdateScheduleCommand): Promise<MaintenanceScheduleEntity>;
  delete(id: string): Promise<void>;
  autoScheduleForEquipment(equipmentId: string, pdmScore: number): Promise<MaintenanceScheduleEntity>;
}

/**
 * Port for maintenance template persistence
 */
export interface IMaintenanceTemplateRepository {
  findAll(orgId?: string, equipmentType?: string, isActive?: boolean): Promise<MaintenanceTemplateEntity[]>;
  findById(id: string, orgId?: string): Promise<MaintenanceTemplateEntity | undefined>;
  create(template: CreateTemplateCommand): Promise<MaintenanceTemplateEntity>;
  update(id: string, updates: UpdateTemplateCommand, orgId?: string): Promise<MaintenanceTemplateEntity>;
  delete(id: string, orgId?: string): Promise<void>;
}

/**
 * Port for publishing domain events
 */
export interface IEventPublisher {
  publish(event: MaintenanceDomainEvent): Promise<void>;
  publishBatch(events: MaintenanceDomainEvent[]): Promise<void>;
}

/**
 * Port for real-time sync (MQTT/WebSocket)
 */
export interface IRealtimeSyncPort {
  publishChange(params: {
    entityType: string;
    operation: 'create' | 'update' | 'delete';
    entityId: string;
    payload: unknown;
  }): Promise<void>;
}

/**
 * Port for audit trail
 */
export interface IAuditPort {
  record(params: {
    entityType: string;
    entityId: string;
    operation: string;
    payload: unknown;
    userId?: string;
  }): Promise<void>;
}
