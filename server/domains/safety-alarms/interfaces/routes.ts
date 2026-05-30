/**
 * Safety Alarms Routes (Interfaces Layer)
 * Admin-gated HTTP concerns for configuring + triggering emergency alarms.
 *
 * NOTE: in-app emergency notice only — never a replacement for physical
 * alarms or muster procedures. User-facing reads/acks live in the
 * me-portal domain.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { safetyAlarmService, AlarmValidationError } from "../service";
import { requireOrgId, type AuthenticatedRequest } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role-auth";
import { withErrorHandling } from "../../../lib/route-utils";
import { auditService } from "../../../compliance/immutable-audit";
import { ALARM_SEVERITIES, ALARM_MODES } from "@shared/role-dashboard";

const SAFETY_ALARM_WRITE_ROLES = [
  "system_admin",
  "company_admin",
  "chief_engineer",
  "fleet_manager",
  "captain",
  "admin",
] as const;
const requireSafetyAlarmWriteRole = requireRole(...SAFETY_ALARM_WRITE_ROLES);

const severityEnum = z.enum(ALARM_SEVERITIES);
const modeEnum = z.enum(ALARM_MODES);

const createTypeSchema = z.object({
  key: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  defaultSeverity: severityEnum.optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional(),
});

const updateTypeSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultSeverity: severityEnum.optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const triggerSchema = z.object({
  alarmTypeId: z.string().min(1),
  vesselId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  message: z.string().optional(),
  severity: severityEnum.optional(),
  mode: modeEnum.optional(),
  confirmed: z.boolean().optional(),
});

function statusForError(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "CONFIRMATION_REQUIRED":
      return 428;
    case "RESERVED_KEY":
    case "PROTECTED_TYPE":
      return 409;
    case "TYPE_NOT_FOUND":
      return 422;
    default:
      return 400;
  }
}

function handleAlarmError(error: unknown, res: Response): boolean {
  if (error instanceof AlarmValidationError) {
    res.status(statusForError(error.code)).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

export function registerSafetyAlarmRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    writeOperationRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  },
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  app.get(
    "/api/admin/safety-alarm-types",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    generalApiRateLimit,
    withErrorHandling("list safety alarm types", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { includeInactive } = z
        .object({
          includeInactive: z
            .enum(["true", "false"])
            .optional()
            .transform((value) => value === "true"),
        })
        .parse(req.query);
      const types = await safetyAlarmService.listTypes(orgId, includeInactive);
      return res.json(types);
    }),
  );

  app.post(
    "/api/admin/safety-alarm-types",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    writeLimit,
    withErrorHandling("create safety alarm type", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const data = createTypeSchema.parse(req.body);
      try {
        const created = await safetyAlarmService.createType({
          ...data,
          orgId: authReq.orgId,
          createdBy: authReq.user?.id,
        });
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "configuration_change",
          eventType: "create",
          entityType: "safety_alarm_type",
          entityId: created.id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { key: created.key, displayName: created.displayName },
        });
        return res.status(201).json(created);
      } catch (error) {
        if (handleAlarmError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.patch(
    "/api/admin/safety-alarm-types/:id",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    writeLimit,
    withErrorHandling("update safety alarm type", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const data = updateTypeSchema.parse(req.body);
      try {
        const updated = await safetyAlarmService.updateType(authReq.orgId, req.params['id'], data);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "configuration_change",
          eventType: "update",
          entityType: "safety_alarm_type",
          entityId: updated.id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          changedFields: Object.keys(data),
        });
        return res.json(updated);
      } catch (error) {
        if (handleAlarmError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.delete(
    "/api/admin/safety-alarm-types/:id",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    writeLimit,
    withErrorHandling("delete safety alarm type", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        await safetyAlarmService.deleteType(authReq.orgId, req.params['id']);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "configuration_change",
          eventType: "delete",
          entityType: "safety_alarm_type",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
        });
        return res.status(204).send();
      } catch (error) {
        if (handleAlarmError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.get(
    "/api/admin/safety-alarms",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    generalApiRateLimit,
    withErrorHandling("list safety alarms", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { vesselId, includeCleared } = z
        .object({
          vesselId: z.string().optional(),
          includeCleared: z
            .enum(["true", "false"])
            .optional()
            .transform((value) => value === "true"),
        })
        .parse(req.query);
      const alarms = await safetyAlarmService.listAlarms(orgId, {
        includeCleared,
        ...(vesselId !== undefined && { vesselId }),
      });
      return res.json(alarms);
    }),
  );

  app.post(
    "/api/admin/safety-alarms",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    writeLimit,
    withErrorHandling("trigger safety alarm", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { confirmed, ...data } = triggerSchema.parse(req.body);
      try {
        const alarm = await safetyAlarmService.triggerAlarm(
          {
            ...data,
            orgId: authReq.orgId,
            triggeredBy: authReq.user?.id,
            triggeredByName: authReq.user?.name ?? authReq.user?.email,
          },
          confirmed ?? false,
        );
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "alert_triggered",
          entityType: "safety_alarm",
          entityId: alarm.id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          ...(alarm.vesselId ? { vesselId: alarm.vesselId } : {}),
          newState: { severity: alarm.severity, mode: alarm.mode, title: alarm.title },
        });
        return res.status(201).json(alarm);
      } catch (error) {
        if (handleAlarmError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/admin/safety-alarms/:id/clear",
    requireOrgId,
    requireSafetyAlarmWriteRole,
    writeLimit,
    withErrorHandling("clear safety alarm", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        const cleared = await safetyAlarmService.clearAlarm(
          authReq.orgId,
          req.params['id'],
          authReq.user?.id,
          authReq.user?.name ?? authReq.user?.email,
        );
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "update",
          entityType: "safety_alarm",
          entityId: cleared.id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { status: "cleared" },
        });
        return res.json(cleared);
      } catch (error) {
        if (handleAlarmError(error, res)) return undefined;
        throw error;
      }
    }),
  );
}
