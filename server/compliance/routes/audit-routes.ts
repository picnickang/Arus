import { Router, Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "../../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { requireAdminAuth } from "../../security.js";
const logger = createLogger("Compliance:Routes:AuditRoutes");
import {
  auditService,
  type AuditEventCategory,
  type AuditEventType,
} from "../immutable-audit.service";

const router = Router();

const requireComplianceAccess = requireAdminAuth;

const auditQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  eventCategory: z.string().optional(),
  eventType: z.string().optional(),
  performedBy: z.string().optional(),
  vesselId: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

const verifyChainSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const logEventSchema = z.object({
  eventCategory: z.enum([
    "system",
    "authentication",
    "data_modification",
    "configuration_change",
    "ml_prediction",
    "maintenance_action",
    "compliance_event",
    "security_event",
  ]),
  eventType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  previousState: z.record(z.unknown()).optional(),
  newState: z.record(z.unknown()).optional(),
  changedFields: z.array(z.string()).optional(),
  performedBy: z.string().optional(),
  performedByType: z.enum(["user", "system", "cron", "ml_service", "edge_device"]).optional(),
  performedByName: z.string().optional(),
  performedByRole: z.string().optional(),
  ipAddress: z.string().optional(),
  deviceId: z.string().optional(),
  vesselId: z.string().optional(),
  complianceStandard: z.string().optional(),
  retentionRequired: z.boolean().optional(),
  retentionExpiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.get("/audit", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const query = auditQuerySchema.parse(req.query);
    const events = await auditService.queryEvents({
      orgId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      entityType: query.entityType,
      entityId: query.entityId,
      eventCategory: query.eventCategory as AuditEventCategory,
      eventType: query.eventType as AuditEventType,
      performedBy: query.performedBy,
      vesselId: query.vesselId,
      limit: query.limit,
      offset: query.offset,
    });
    res.json({
      success: true,
      data: events,
      pagination: { limit: query.limit, offset: query.offset, count: events.length },
    });
  } catch (error) {
    logger.error("[Compliance] Audit query error:", undefined, error);
    res
      .status(500)
      .json({
        error: "Failed to query audit trail",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

router.post("/audit", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const eventData = logEventSchema.parse(req.body);
    const event = await auditService.logEvent({
      ...{} as any,
      orgId,
      ...eventData,
      performedBy: req.user?.id ?? "system",
      performedByType: req.user ? "user" : "system",
      performedByName: req.user?.name ?? req.user?.email ?? "System",
      performedByRole: req.user?.role ?? "system",
      ipAddress: req.ip,
      metadata: {
        ...(eventData.metadata ?? {}),
        clientSuppliedActor: eventData.performedBy
          ? {
              performedBy: eventData.performedBy,
              performedByType: eventData.performedByType,
              performedByName: eventData.performedByName,
              performedByRole: eventData.performedByRole,
              ipAddress: eventData.ipAddress,
            }
          : undefined,
      },
    });
    res
      .status(201)
      .json({
        success: true,
        data: { id: event.id, hash: event.hash, timestamp: (event as any).timestamp },
      });
  } catch (error) {
    logger.error("[Compliance] Log event error:", undefined, error);
    res
      .status(500)
      .json({
        error: "Failed to log audit event",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

router.post("/audit/verify", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const query = verifyChainSchema.parse(req.query);
    const result = await auditService.verifyChain(
      orgId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("[Compliance] Chain verification error:", undefined, error);
    res
      .status(500)
      .json({
        error: "Failed to verify audit chain",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

router.get("/audit/stats", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const query = verifyChainSchema.parse(req.query);
    const stats = await auditService.getStats(
      orgId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error("[Compliance] Stats error:", undefined, error);
    res
      .status(500)
      .json({
        error: "Failed to get audit statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

router.get(
  "/audit/entity/:entityType/:entityId",
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const { entityType, entityId } = req.params;
      const query = auditQuerySchema.parse(req.query);
      const events = await auditService.queryEvents({
        orgId,
        entityType,
        entityId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit,
        offset: query.offset,
      });
      res.json({
        success: true,
        data: events,
        entity: { type: entityType, id: entityId },
        pagination: { limit: query.limit, offset: query.offset, count: events.length },
      });
    } catch (error) {
      logger.error("[Compliance] Entity audit query error:", undefined, error);
      res
        .status(500)
        .json({
          error: "Failed to query entity audit history",
          details: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }
);

router.get("/reports/ism", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const query = verifyChainSchema.parse(req.query);
    const maintenanceEvents = await auditService.queryEvents({
      orgId,
      eventCategory: "maintenance_action",
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: 1000,
    });
    const mlEvents = await auditService.queryEvents({
      orgId,
      eventCategory: "ml_prediction",
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: 1000,
    });
    const chainIntegrity = await auditService.verifyChain(
      orgId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );
    const workOrdersCreated = maintenanceEvents.filter(
      (e) => e.eventType === "work_order_created"
    ).length;
    const workOrdersCompleted = maintenanceEvents.filter(
      (e) => e.eventType === "work_order_completed"
    ).length;
    const predictionsGenerated = mlEvents.filter(
      (e) => e.eventType === "prediction_generated"
    ).length;
    const predictionsOverridden = mlEvents.filter(
      (e) => e.eventType === "prediction_overridden"
    ).length;
    res.json({
      success: true,
      report: {
        type: "ISM_CODE_COMPLIANCE",
        generatedAt: new Date().toISOString(),
        period: { start: query.startDate, end: query.endDate },
        summary: {
          maintenanceCompliance: {
            workOrdersCreated,
            workOrdersCompleted,
            completionRate:
              workOrdersCreated > 0
                ? Math.round((workOrdersCompleted / workOrdersCreated) * 100)
                : 100,
          },
          predictiveMaintenanceActivity: {
            predictionsGenerated,
            predictionsOverridden,
            overrideRate:
              predictionsGenerated > 0
                ? Math.round((predictionsOverridden / predictionsGenerated) * 100)
                : 0,
          },
          auditIntegrity: {
            valid: chainIntegrity.valid,
            recordsVerified: chainIntegrity.recordsVerified,
            tamperEvidence: chainIntegrity.valid ? "none" : chainIntegrity.error,
          },
        },
        compliance: {
          section10_4: chainIntegrity.valid ? "COMPLIANT" : "NON_COMPLIANT",
          recordRetention: "COMPLIANT",
          tamperEvidence: chainIntegrity.valid ? "VERIFIED" : "TAMPERING_DETECTED",
        },
      },
    });
  } catch (error) {
    logger.error("[Compliance] ISM report error:", undefined, error);
    res
      .status(500)
      .json({
        error: "Failed to generate ISM compliance report",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

router.get("/reports/cyber", requireComplianceAccess, async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    if (!orgId) {
      return res.status(401).json({ error: "Organization ID required" });
    }
    const query = verifyChainSchema.parse(req.query);
    const securityEvents = await auditService.queryEvents({
      orgId,
      eventCategory: "security_event",
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: 1000,
    });
    const authEvents = await auditService.queryEvents({
      orgId,
      eventCategory: "authentication",
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: 1000,
    });
    const chainIntegrity = await auditService.verifyChain(
      orgId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined
    );
    const loginAttempts = authEvents.filter((e) => e.eventType === "login").length;
    const failedLogins = authEvents.filter((e) => e.eventType === "login_failed").length;
    const securityIncidents = securityEvents.length;
    res.json({
      success: true,
      report: {
        type: "IMO_2021_CYBERSECURITY",
        generatedAt: new Date().toISOString(),
        period: { start: query.startDate, end: query.endDate },
        summary: {
          authentication: {
            totalAttempts: loginAttempts,
            failedAttempts: failedLogins,
            successRate:
              loginAttempts > 0
                ? Math.round(((loginAttempts - failedLogins) / loginAttempts) * 100)
                : 100,
          },
          securityEvents: {
            total: securityIncidents,
            byType: securityEvents.reduce(
              (acc, e) => {
                acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
          },
          auditIntegrity: {
            valid: chainIntegrity.valid,
            recordsVerified: chainIntegrity.recordsVerified,
          },
        },
        compliance: {
          accessControl: loginAttempts > 0 ? "IMPLEMENTED" : "NOT_TESTED",
          auditLogging: "IMPLEMENTED",
          tamperEvidence: chainIntegrity.valid ? "VERIFIED" : "ALERT",
          incidentResponse: securityIncidents > 0 ? "ACTIVE" : "STANDBY",
        },
      },
    });
  } catch (error) {
    logger.error("[Compliance] Cyber report error:", undefined, error);
    res
      .status(500)
      .json({
        error: "Failed to generate cybersecurity compliance report",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

export { router as complianceAuditRouter, requireComplianceAccess };
