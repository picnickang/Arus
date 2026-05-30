/**
 * Safety Alarms Application Service
 * Orchestrates domain logic using ports (interfaces).
 *
 * NOTE: in-app emergency notice only — never a replacement for physical
 * alarms or muster procedures.
 */

import type { ISafetyAlarmRepository } from "../domain/ports";
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
} from "../domain/types";
import { PROTECTED_ALARM_TYPE_KEYS } from "@shared/role-dashboard";

export class AlarmValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AlarmValidationError";
  }
}

export class SafetyAlarmApplicationService {
  constructor(private readonly repo: ISafetyAlarmRepository) {}

  async listTypes(orgId: string, includeInactive = false): Promise<SafetyAlarmTypeEntity[]> {
    await this.repo.ensureProtectedTypes(orgId);
    return this.repo.findTypes(orgId, includeInactive);
  }

  async createType(command: CreateAlarmTypeCommand): Promise<SafetyAlarmTypeEntity> {
    const key = command.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) {
      throw new AlarmValidationError("Alarm type key is required", "INVALID_KEY");
    }
    if (PROTECTED_ALARM_TYPE_KEYS.includes(key)) {
      throw new AlarmValidationError(
        "That key is reserved by a built-in protected alarm type",
        "RESERVED_KEY",
      );
    }
    return this.repo.createType({ ...command, key });
  }

  async updateType(
    orgId: string,
    id: string,
    patch: UpdateAlarmTypeCommand,
  ): Promise<SafetyAlarmTypeEntity> {
    const existing = await this.repo.findTypeById(orgId, id);
    if (!existing) {
      throw new AlarmValidationError("Alarm type not found", "NOT_FOUND");
    }
    // Protected types may be re-styled (icon/colour) and toggled but their
    // identity (key) and acknowledgement requirement are locked.
    if (existing.isProtected) {
      const lockedPatch: UpdateAlarmTypeCommand = {
        ...(patch.icon !== undefined && { icon: patch.icon }),
        ...(patch.color !== undefined && { color: patch.color }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
      };
      const updated = await this.repo.updateType(orgId, id, lockedPatch);
      if (!updated) {
        throw new AlarmValidationError("Alarm type not found", "NOT_FOUND");
      }
      return updated;
    }
    const updated = await this.repo.updateType(orgId, id, patch);
    if (!updated) {
      throw new AlarmValidationError("Alarm type not found", "NOT_FOUND");
    }
    return updated;
  }

  async deleteType(orgId: string, id: string): Promise<void> {
    const existing = await this.repo.findTypeById(orgId, id);
    if (!existing) {
      throw new AlarmValidationError("Alarm type not found", "NOT_FOUND");
    }
    if (existing.isProtected) {
      throw new AlarmValidationError(
        "Protected alarm types cannot be deleted",
        "PROTECTED_TYPE",
      );
    }
    await this.repo.deactivateType(orgId, id);
  }

  async listAlarms(orgId: string, filters?: ListAlarmsFilters): Promise<SafetyAlarmWithAcks[]> {
    return this.repo.findAlarms(orgId, filters);
  }

  async listActiveForUser(orgId: string, scope: UserAlarmScope): Promise<SafetyAlarmWithAcks[]> {
    return this.repo.findActiveAlarmsForScope(orgId, scope);
  }

  /**
   * Trigger an alarm. Critical/emergency alarms in real mode require an
   * explicit `confirmed` flag from the caller (route layer) to guard against
   * accidental activation.
   */
  async triggerAlarm(
    command: TriggerAlarmCommand,
    confirmed: boolean,
  ): Promise<SafetyAlarmEntity> {
    const type = await this.repo.findTypeById(command.orgId, command.alarmTypeId);
    if (!type || !type.isActive) {
      throw new AlarmValidationError("Alarm type not found or inactive", "TYPE_NOT_FOUND");
    }
    const severity = command.severity ?? type.defaultSeverity;
    const mode = command.mode ?? "real";
    const needsConfirm =
      mode === "real" && (severity === "critical" || severity === "emergency");
    if (needsConfirm && !confirmed) {
      throw new AlarmValidationError(
        "This high-severity alarm must be explicitly confirmed before activation",
        "CONFIRMATION_REQUIRED",
      );
    }
    return this.repo.trigger({
      ...command,
      severity,
      mode,
      title: command.title ?? type.displayName,
    });
  }

  async clearAlarm(
    orgId: string,
    id: string,
    clearedBy: string | undefined,
    clearedByName: string | undefined,
  ): Promise<SafetyAlarmEntity> {
    const cleared = await this.repo.clear(orgId, id, clearedBy, clearedByName);
    if (!cleared) {
      throw new AlarmValidationError("Alarm not found", "NOT_FOUND");
    }
    return cleared;
  }

  async acknowledge(command: AcknowledgeAlarmCommand): Promise<SafetyAlarmAckEntity> {
    const alarm = await this.repo.findAlarmById(command.orgId, command.alarmId);
    if (!alarm) {
      throw new AlarmValidationError("Alarm not found", "NOT_FOUND");
    }
    return this.repo.acknowledge(command);
  }
}
