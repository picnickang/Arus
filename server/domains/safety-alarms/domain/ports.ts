/**
 * Safety Alarms Domain - Ports (Interfaces)
 * Contracts implemented by infrastructure adapters.
 */

import type {
  SafetyAlarmTypeEntity,
  SafetyAlarmEntity,
  SafetyAlarmWithAcks,
  SafetyAlarmAckEntity,
  CreateAlarmTypeCommand,
  UpdateAlarmTypeCommand,
  TriggerAlarmCommand,
  ListAlarmsFilters,
  UserAlarmScope,
  AcknowledgeAlarmCommand,
} from "./types";

export interface ISafetyAlarmRepository {
  /** Seed the org's protected alarm types if none exist yet (idempotent). */
  ensureProtectedTypes(orgId: string): Promise<void>;

  findTypes(orgId: string, includeInactive?: boolean): Promise<SafetyAlarmTypeEntity[]>;
  findTypeById(orgId: string, id: string): Promise<SafetyAlarmTypeEntity | undefined>;
  createType(command: CreateAlarmTypeCommand): Promise<SafetyAlarmTypeEntity>;
  updateType(
    orgId: string,
    id: string,
    patch: UpdateAlarmTypeCommand,
  ): Promise<SafetyAlarmTypeEntity | undefined>;
  deactivateType(orgId: string, id: string): Promise<void>;

  findAlarms(orgId: string, filters?: ListAlarmsFilters): Promise<SafetyAlarmWithAcks[]>;
  findActiveAlarmsForScope(orgId: string, scope: UserAlarmScope): Promise<SafetyAlarmWithAcks[]>;
  findAlarmById(orgId: string, id: string): Promise<SafetyAlarmEntity | undefined>;
  trigger(command: TriggerAlarmCommand): Promise<SafetyAlarmEntity>;
  clear(
    orgId: string,
    id: string,
    clearedBy: string | undefined,
    clearedByName: string | undefined,
  ): Promise<SafetyAlarmEntity | undefined>;

  acknowledge(command: AcknowledgeAlarmCommand): Promise<SafetyAlarmAckEntity>;
}
