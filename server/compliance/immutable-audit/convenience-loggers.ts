/**
 * Convenience Audit Loggers
 *
 * Pre-configured logging methods for common audit events.
 */

import type { AuditEventInput, AuditRecord, AuditEventType } from "./types";

type LogEventFn = (input: AuditEventInput) => Promise<AuditRecord>;

/**
 * Create convenience logging methods bound to the logEvent function
 */
export function createConvenienceLoggers(logEvent: LogEventFn) {
  return {
    async logLogin(
      orgId: string,
      userId: string,
      userName: string,
      ipAddress?: string,
      deviceId?: string,
      success: boolean = true
    ): Promise<AuditRecord> {
      return logEvent({
        orgId,
        eventCategory: "authentication",
        eventType: success ? "login" : "login_failed",
        entityType: "user",
        entityId: userId,
        performedBy: userId,
        performedByName: userName,
        performedByType: "user",
        ipAddress,
        deviceId,
        metadata: { success },
      });
    },

    async logDataChange<T extends Record<string, unknown>>(
      orgId: string,
      entityType: string,
      entityId: string,
      eventType: "create" | "update" | "delete",
      performedBy: string,
      performedByName?: string,
      previousState?: T,
      newState?: T,
      ipAddress?: string
    ): Promise<AuditRecord> {
      const changedFields =
        previousState && newState
          ? Object.keys(newState).filter((k) => previousState[k] !== newState[k])
          : undefined;

      return logEvent({
        orgId,
        eventCategory: "data_modification",
        eventType,
        entityType,
        entityId,
        previousState,
        newState,
        changedFields,
        performedBy,
        performedByName,
        performedByType: "user",
        ipAddress,
      });
    },

    async logMLPrediction(
      orgId: string,
      equipmentId: string,
      predictionId: string,
      prediction: Record<string, unknown>,
      modelId?: string
    ): Promise<AuditRecord> {
      return logEvent({
        orgId,
        eventCategory: "ml_prediction",
        eventType: "prediction_generated",
        entityType: "equipment",
        entityId: equipmentId,
        performedBy: "ml_service",
        performedByType: "ml_service",
        newState: prediction,
        metadata: { predictionId, modelId },
      });
    },

    async logPredictionOverride(
      orgId: string,
      equipmentId: string,
      overrideId: string,
      originalPrediction: Record<string, unknown>,
      newValues: Record<string, unknown>,
      engineerId: string,
      engineerName: string,
      justification: string
    ): Promise<AuditRecord> {
      return logEvent({
        orgId,
        eventCategory: "ml_prediction",
        eventType: "prediction_overridden",
        entityType: "equipment",
        entityId: equipmentId,
        previousState: originalPrediction,
        newState: newValues,
        performedBy: engineerId,
        performedByName: engineerName,
        performedByType: "user",
        complianceStandard: "ML_GOVERNANCE",
        metadata: { overrideId, justification },
      });
    },

    async logWorkOrderAction(
      orgId: string,
      workOrderId: string,
      eventType: "work_order_created" | "work_order_completed" | "work_order_cancelled",
      performedBy: string,
      performedByName?: string,
      previousState?: Record<string, unknown>,
      newState?: Record<string, unknown>,
      vesselId?: string
    ): Promise<AuditRecord> {
      return logEvent({
        orgId,
        eventCategory: "maintenance_action",
        eventType,
        entityType: "work_order",
        entityId: workOrderId,
        previousState,
        newState,
        performedBy,
        performedByName,
        performedByType: "user",
        vesselId,
        complianceStandard: "ISM_CODE",
      });
    },

    async logSecurityEvent(
      orgId: string,
      eventType: AuditEventType,
      entityType: string,
      entityId: string,
      performedBy: string,
      ipAddress?: string,
      metadata?: Record<string, unknown>
    ): Promise<AuditRecord> {
      return logEvent({
        orgId,
        eventCategory: "security_event",
        eventType,
        entityType,
        entityId,
        performedBy,
        performedByType: "system",
        ipAddress,
        complianceStandard: "IMO_2021_CYBER",
        metadata,
      });
    },

    async logComplianceEvent(
      orgId: string,
      eventType: AuditEventType,
      entityType: string,
      entityId: string,
      performedBy: string,
      complianceStandard: string,
      metadata?: Record<string, unknown>
    ): Promise<AuditRecord> {
      return logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType,
        entityType,
        entityId,
        performedBy,
        performedByType: "user",
        complianceStandard,
        retentionRequired: true,
        metadata,
      });
    },
  };
}
