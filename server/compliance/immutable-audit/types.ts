/**
 * Immutable Audit Types
 *
 * Type definitions for tamper-evident audit logging.
 * Implements requirements for ISM Code, Class Society, and IMO 2021 Cybersecurity.
 */

export type AuditEventCategory =
  | "system"
  | "authentication"
  | "data_modification"
  | "configuration_change"
  | "ml_prediction"
  | "maintenance_action"
  | "compliance_event"
  | "security_event";

export type AuditEventType =
  | "create"
  | "update"
  | "delete"
  | "read"
  | "login"
  | "logout"
  | "login_failed"
  | "session_expired"
  | "prediction_generated"
  | "prediction_overridden"
  | "work_order_created"
  | "work_order_completed"
  | "work_order_cancelled"
  | "equipment_status_change"
  | "alert_triggered"
  | "alert_acknowledged"
  | "model_trained"
  | "model_deployed"
  | "model_retired"
  | "config_updated"
  | "permission_changed"
  | "data_export"
  | "data_import"
  | "dsar_request"
  | "data_deletion"
  | "vessel_sync"
  | "sync_conflict"
  | "data_export_initiated"
  | "data_export_completed"
  | "data_export_downloaded"
  | "dsar_list_viewed"
  | "dsar_created"
  | "dsar_acknowledged"
  | "dsar_data_collected"
  | "dsar_erasure_executed"
  | "dsar_completed"
  | "dsar_rejected"
  | "engineer_override_created"
  | "engineer_override_outcome_updated";

export type PerformerType = "user" | "system" | "cron" | "ml_service" | "edge_device";

export interface AuditEventInput {
  orgId: string;
  eventCategory: AuditEventCategory;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changedFields?: string[];
  performedBy: string;
  performedByType?: PerformerType;
  performedByName?: string;
  performedByRole?: string;
  ipAddress?: string;
  deviceId?: string;
  vesselId?: string;
  complianceStandard?: string;
  retentionRequired?: boolean;
  retentionExpiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AuditRecord {
  id: string;
  orgId: string;
  eventCategory: AuditEventCategory;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  changedFields?: string[];
  performedBy: string;
  performedByType: PerformerType;
  performedByName?: string;
  performedByRole?: string;
  ipAddress?: string;
  deviceId?: string;
  vesselId?: string;
  eventTimestamp: Date;
  serverTimestamp: Date;
  prevHash?: string;
  hash: string;
  complianceStandard?: string;
  retentionRequired: boolean;
  retentionExpiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ChainVerificationResult {
  valid: boolean;
  recordsVerified: number;
  brokenAt?: number;
  brokenRecordId?: string;
  error?: string;
}

export interface AuditQueryOptions {
  orgId: string;
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
  entityId?: string;
  eventCategory?: AuditEventCategory;
  eventType?: AuditEventType;
  performedBy?: string;
  vesselId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByType: Record<string, number>;
  chainIntegrity: ChainVerificationResult;
}
