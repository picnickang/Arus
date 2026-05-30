/**
 * Safety Alarms Domain - Domain Types
 * Pure domain types without infrastructure dependencies.
 */

export interface SafetyAlarmTypeEntity {
  id: string;
  orgId: string;
  key: string;
  displayName: string;
  description: string | null;
  defaultSeverity: string;
  icon: string | null;
  color: string | null;
  requiresAcknowledgement: boolean;
  isProtected: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SafetyAlarmAckEntity {
  id: string;
  orgId: string;
  alarmId: string;
  userId: string;
  userName: string | null;
  source: string | null;
  comment: string | null;
  acknowledgedAt: Date | null;
}

export interface SafetyAlarmEntity {
  id: string;
  orgId: string;
  alarmTypeId: string;
  vesselId: string | null;
  title: string;
  message: string | null;
  severity: string;
  mode: string;
  status: string;
  requiresAcknowledgement: boolean;
  triggeredBy: string | null;
  triggeredByName: string | null;
  triggeredAt: Date | null;
  clearedBy: string | null;
  clearedByName: string | null;
  clearedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SafetyAlarmWithAcks extends SafetyAlarmEntity {
  acknowledgements: SafetyAlarmAckEntity[];
}

export interface CreateAlarmTypeCommand {
  orgId: string;
  key: string;
  displayName: string;
  description?: string | undefined;
  defaultSeverity?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  requiresAcknowledgement?: boolean | undefined;
  createdBy?: string | undefined;
}

export interface UpdateAlarmTypeCommand {
  displayName?: string | undefined;
  description?: string | undefined;
  defaultSeverity?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  requiresAcknowledgement?: boolean | undefined;
  isActive?: boolean | undefined;
}

export interface TriggerAlarmCommand {
  orgId: string;
  alarmTypeId: string;
  vesselId?: string | undefined;
  title?: string | undefined;
  message?: string | undefined;
  severity?: string | undefined;
  mode?: string | undefined;
  /**
   * Whether crew must acknowledge this alarm. Resolved from the alarm type's
   * `requiresAcknowledgement` at trigger time so a configurable non-ack type is
   * honoured (the column otherwise defaults to true at the DB level).
   */
  requiresAcknowledgement?: boolean | undefined;
  triggeredBy?: string | undefined;
  triggeredByName?: string | undefined;
}

export interface ListAlarmsFilters {
  vesselId?: string | undefined;
  includeCleared?: boolean | undefined;
}

/** Scope used to resolve which active alarms a user can see. */
export interface UserAlarmScope {
  vesselIds: string[];
  fleetWide: boolean;
}

export interface AcknowledgeAlarmCommand {
  orgId: string;
  alarmId: string;
  userId: string;
  userName?: string | undefined;
  source?: string | undefined;
  comment?: string | undefined;
}
