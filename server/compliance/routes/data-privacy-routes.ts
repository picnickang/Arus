import { Router, Request, Response } from "express";
import { z } from "zod";
import { auditService } from "../immutable-audit.service";
import { requireAdminAuth, auditAdminAction } from "../../security";
import { DataExportImportService } from "../../services/data-export-import";
import { DataAnonymizationService, type AnonymizationLevel } from "../data-anonymization.service";
import { dbGdprStorage } from "../../db/gdpr";
import { requireComplianceAccess } from "./audit-routes";
import { createLogger } from "../../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Compliance:Routes:DataPrivacyRoutes");

interface AdminRequest extends Request {
  adminId?: string;
}

const router = Router();
const exportService = new DataExportImportService("./data-exports");

const anonymizedExportSchema = z.object({
  anonymize: z.enum(["none", "partial", "full"]).default("none"),
  includeTelemetry: z.coerce.boolean().default(false),
  telemetryDays: z.coerce.number().min(1).max(365).default(30),
  includeKnowledgeBase: z.coerce.boolean().default(true),
  includeAuditLogs: z.coerce.boolean().default(false),
  preserveIds: z.coerce.boolean().default(true),
  preserveTimestamps: z.coerce.boolean().default(true),
  preserveTechnicalData: z.coerce.boolean().default(true),
});

const dsarRequestSchema = z.object({
  requesterEmail: z.string().email(),
  requesterName: z.string().optional(),
  requesterType: z.enum(["crew_member", "user", "external"]),
  requestType: z.enum(["access", "rectification", "erasure", "portability", "restrict_processing"]),
  requestDescription: z.string().optional(),
  dataCategories: z.array(z.string()).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

const dsarFilterSchema = z.object({
  status: z.string().optional(),
  requestType: z.string().optional(),
  requesterEmail: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

router.post(
  "/export/anonymized",
  requireAdminAuth,
  auditAdminAction("compliance_export_anonymized"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const options = anonymizedExportSchema.parse(req.body);
      const exportedBy = (req as AdminRequest).adminId || "admin";
      logger.info(`[Compliance] Starting anonymized export for org: ${orgId}, level: ${options.anonymize}`);
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "data_export_initiated",
        entityType: "organization",
        entityId: orgId,
        performedBy: exportedBy,
        performedByType: "user",
        metadata: {
          anonymizationLevel: options.anonymize,
          includeTelemetry: options.includeTelemetry,
          telemetryDays: options.telemetryDays,
        },
        retentionRequired: true,
      });
      const result = await exportService.exportOrg(
        orgId,
        {
          includeTelemetry: options.includeTelemetry,
          telemetryDays: options.telemetryDays,
          includeKnowledgeBase: options.includeKnowledgeBase,
          includeAuditLogs: options.includeAuditLogs,
          anonymize: options.anonymize as AnonymizationLevel,
          anonymizationConfig: {
            preserveIds: options.preserveIds,
            preserveTimestamps: options.preserveTimestamps,
            preserveTechnicalData: options.preserveTechnicalData,
          },
        },
        exportedBy
      );
      if (result.success) {
        await auditService.logEvent({
          orgId,
          eventCategory: "compliance_event",
          eventType: "data_export_completed",
          entityType: "organization",
          entityId: orgId,
          performedBy: exportedBy,
          performedByType: "user",
          metadata: { exportId: result.exportId, duration: result.duration },
          retentionRequired: true,
        });
        res.json({
          success: true,
          data: {
            exportId: result.exportId,
            filePath: result.filePath,
            duration: result.duration,
            anonymizationLevel: options.anonymize,
            manifest: result.manifest,
          },
        });
      } else {
        res.status(500).json({ success: false, error: result.error, exportId: result.exportId });
      }
    } catch (error) {
      logger.error("[Compliance] Anonymized export error:", undefined, error);
      res
        .status(500)
        .json({
          error: "Failed to create anonymized export",
          details: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }
);

router.get(
  "/export/anonymized/:exportId",
  requireAdminAuth,
  auditAdminAction("compliance_export_download"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { exportId } = req.params;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const exportPath = `./data-exports/${exportId}.tar.gz`;
      const fs = await import("fs");
      if (!fs.existsSync(exportPath)) {
        return res.status(404).json({ error: "Export not found or expired" });
      }
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "data_export_downloaded",
        entityType: "data_export",
        entityId: exportId,
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        retentionRequired: true,
      });
      res.download(exportPath, `${exportId}.tar.gz`);
    } catch (error) {
      logger.error("[Compliance] Export download error:", undefined, error);
      res.status(500).json({ error: "Failed to download export" });
    }
  }
);

router.get(
  "/anonymization/preview",
  requireAdminAuth,
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const level = (req.query.level as AnonymizationLevel) || "full";
      const sampleRecord = {
        id: "sample-123",
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1-555-123-4567",
        address: "123 Main Street, City, State 12345",
        passportNumber: "AB1234567",
        emergencyContact: "Jane Doe",
        emergencyPhone: "+1-555-987-6543",
        notes: "Sample notes with sensitive information",
        role: "Chief Engineer",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const anonymizationService = new DataAnonymizationService();
      const { record: anonymized, result } = anonymizationService.anonymizeRecord(
        sampleRecord,
        "crew_member",
        level,
        { preserveIds: true, preserveTimestamps: true, preserveTechnicalData: false }
      );
      res.json({
        success: true,
        data: { original: sampleRecord, anonymized, anonymizationResult: result, level },
      });
    } catch (error) {
      logger.error("[Compliance] Anonymization preview error:", undefined, error);
      res.status(500).json({ error: "Failed to preview anonymization" });
    }
  }
);

router.get(
  "/dsar",
  requireAdminAuth,
  auditAdminAction("dsar_list"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const filters = dsarFilterSchema.parse(req.query);
      const requests = await dbGdprStorage.getDataSubjectRequestsFiltered(orgId, {
        status: filters.status,
        requestType: filters.requestType,
        requesterEmail: filters.requesterEmail,
        fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
        toDate: filters.toDate ? new Date(filters.toDate) : undefined,
      });
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_list_viewed",
        entityType: "dsar",
        entityId: "list",
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        metadata: { filters, count: requests.length },
      });
      res.json({ success: true, data: requests, count: requests.length });
    } catch (error) {
      logger.error("[Compliance] DSAR list error:", undefined, error);
      res.status(500).json({ error: "Failed to retrieve DSAR requests" });
    }
  }
);

router.get(
  "/dsar/:id",
  requireAdminAuth,
  auditAdminAction("dsar_view"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { id } = req.params;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const request = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
      if (!request) {
        return res.status(404).json({ error: "DSAR request not found" });
      }
      res.json({ success: true, data: request });
    } catch (error) {
      logger.error("[Compliance] DSAR get error:", undefined, error);
      res.status(500).json({ error: "Failed to retrieve DSAR request" });
    }
  }
);

router.post(
  "/dsar",
  requireAdminAuth,
  auditAdminAction("dsar_create"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const data = dsarRequestSchema.parse(req.body);
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const request = await dbGdprStorage.createDataSubjectRequest({
        orgId,
        ...data,
        dueDate,
      } as any);
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_created",
        entityType: "dsar",
        entityId: request.id,
        newState: request,
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        retentionRequired: true,
      });
      res
        .status(201)
        .json({
          success: true,
          data: request,
          message: `DSAR request created. Due date: ${request.dueDate.toISOString()}`,
        });
    } catch (error) {
      logger.error("[Compliance] DSAR create error:", undefined, error);
      res.status(500).json({ error: "Failed to create DSAR request" });
    }
  }
);

router.post(
  "/dsar/:id/acknowledge",
  requireAdminAuth,
  auditAdminAction("dsar_acknowledge"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { id } = req.params;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const existingRequest = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
      if (!existingRequest) {
        return res.status(404).json({ error: "DSAR request not found" });
      }
      if (existingRequest.status !== "pending") {
        return res
          .status(400)
          .json({
            error: "Invalid state transition",
            message: `DSAR request is already ${existingRequest.status}. Only pending requests can be acknowledged.`,
          });
      }
      const request = await dbGdprStorage.acknowledgeDataSubjectRequest(
        id,
        (req as AdminRequest).adminId || "admin",
        orgId
      );
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_acknowledged",
        entityType: "dsar",
        entityId: id,
        newState: { status: "in_progress", acknowledgedAt: request.acknowledgedAt },
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        retentionRequired: true,
      });
      res.json({
        success: true,
        data: request,
        message: "DSAR request acknowledged and in progress",
      });
    } catch (error) {
      logger.error("[Compliance] DSAR acknowledge error:", undefined, error);
      res.status(500).json({ error: "Failed to acknowledge DSAR request" });
    }
  }
);

router.post(
  "/dsar/:id/collect",
  requireAdminAuth,
  auditAdminAction("dsar_data_collection"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { id } = req.params;
      const { identifierType } = req.body as { identifierType: "email" | "userId" | "crewId" };
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const request = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
      if (!request) {
        return res.status(404).json({ error: "DSAR request not found" });
      }
      const identifier = request.requesterId || request.requesterEmail;
      const type = identifierType || (request.requesterId ? "userId" : "email");
      const collectedData = await dbGdprStorage.collectUserDataForDsar(orgId, identifier, type);
      const collectedDataObj = collectedData as Record<string, unknown>;
      const getArrayLength = (obj: Record<string, unknown>, key: string): number => {
        const arr = obj[key];
        return Array.isArray(arr) ? arr.length : 0;
      };
      const hasData = (obj: Record<string, unknown>, key: string): boolean => {
        const val = obj[key];
        return Array.isArray(val)
          ? val.length > 0
          : typeof val === "object" && val !== null
            ? Object.keys(val).length > 0
            : false;
      };
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_data_collected",
        entityType: "dsar",
        entityId: id,
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        metadata: {
          identifier,
          identifierType: type,
          dataCategories: Object.keys(collectedDataObj).filter((k) => hasData(collectedDataObj, k)),
        },
        retentionRequired: true,
      });
      res.json({
        success: true,
        data: {
          dsarId: id,
          identifier,
          identifierType: type,
          collectedData,
          summary: {
            users: getArrayLength(collectedDataObj, "users"),
            crewMembers: getArrayLength(collectedDataObj, "crewMembers"),
            restRecords: getArrayLength(collectedDataObj, "restRecords"),
            workOrders: getArrayLength(collectedDataObj, "workOrders"),
            auditEvents: getArrayLength(collectedDataObj, "auditEvents"),
          },
        },
      });
    } catch (error) {
      logger.error("[Compliance] DSAR data collection error:", undefined, error);
      res.status(500).json({ error: "Failed to collect data for DSAR" });
    }
  }
);

router.post(
  "/dsar/:id/execute-erasure",
  requireAdminAuth,
  auditAdminAction("dsar_erasure"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { id } = req.params;
      const { confirmErasure, reason } = req.body;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      if (!confirmErasure) {
        return res
          .status(400)
          .json({
            error: "Erasure must be explicitly confirmed",
            message: "Set confirmErasure: true to proceed with data erasure",
          });
      }
      const request = await dbGdprStorage.getDataSubjectRequestWithOrg(id, orgId);
      if (!request) {
        return res.status(404).json({ error: "DSAR request not found" });
      }
      if (request.requestType !== "erasure") {
        return res
          .status(400)
          .json({
            error: "Invalid request type",
            message: "This endpoint is only for erasure requests",
          });
      }
      const erasedBy = (req as AdminRequest).adminId || "admin";
      const result = await dbGdprStorage.executeDataErasure(id, orgId, erasedBy, reason);
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_erasure_executed",
        entityType: "dsar",
        entityId: id,
        performedBy: erasedBy,
        performedByType: "user",
        metadata: { result, reason },
        retentionRequired: true,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error("[Compliance] DSAR erasure error:", undefined, error);
      res.status(500).json({ error: "Failed to execute data erasure" });
    }
  }
);

router.post(
  "/dsar/:id/complete",
  requireAdminAuth,
  auditAdminAction("dsar_complete"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { id } = req.params;
      const { notes } = req.body;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const request = await dbGdprStorage.completeDataSubjectRequest(
        id,
        (req as AdminRequest).adminId || "admin",
        notes,
        orgId
      );
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_completed",
        entityType: "dsar",
        entityId: id,
        newState: { status: "completed", completedAt: request.completedAt },
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        retentionRequired: true,
      });
      res.json({ success: true, data: request, message: "DSAR request completed" });
    } catch (error) {
      logger.error("[Compliance] DSAR complete error:", undefined, error);
      res.status(500).json({ error: "Failed to complete DSAR request" });
    }
  }
);

router.post(
  "/dsar/:id/reject",
  requireAdminAuth,
  auditAdminAction("dsar_reject"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      const { id } = req.params;
      const { reason, rejectionReason } = req.body;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const request = await dbGdprStorage.rejectDataSubjectRequest(
        id,
        (req as AdminRequest).adminId || "admin",
        rejectionReason || reason,
        orgId
      );
      await auditService.logEvent({
        orgId,
        eventCategory: "compliance_event",
        eventType: "dsar_rejected",
        entityType: "dsar",
        entityId: id,
        newState: { status: "rejected", rejectionReason: rejectionReason || reason },
        performedBy: (req as AdminRequest).adminId || "admin",
        performedByType: "user",
        retentionRequired: true,
      });
      res.json({ success: true, data: request, message: "DSAR request rejected" });
    } catch (error) {
      logger.error("[Compliance] DSAR reject error:", undefined, error);
      res.status(500).json({ error: "Failed to reject DSAR request" });
    }
  }
);

router.get(
  "/dsar/statistics",
  requireAdminAuth,
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = DEFAULT_ORG_ID;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const allRequests = await dbGdprStorage.getDataSubjectRequestsFiltered(orgId, {});
      const stats = {
        total: allRequests.length,
        byStatus: {} as Record<string, number>,
        byType: {} as Record<string, number>,
        avgCompletionDays: 0,
        overdueCount: 0,
      };
      let completedDays = 0,
        completedCount = 0;
      const now = new Date();
      for (const req of allRequests) {
        stats.byStatus[req.status] = (stats.byStatus[req.status] ?? 0) + 1;
        stats.byType[req.requestType] = (stats.byType[req.requestType] ?? 0) + 1;
        if (req.completedAt && req.createdAt) {
          completedDays +=
            (new Date(req.completedAt).getTime() - new Date(req.createdAt).getTime()) /
            (1000 * 60 * 60 * 24);
          completedCount++;
        }
        if (
          req.status !== "completed" &&
          req.status !== "rejected" &&
          req.dueDate &&
          new Date(req.dueDate) < now
        ) {
          stats.overdueCount++;
        }
      }
      stats.avgCompletionDays =
        completedCount > 0 ? Math.round((completedDays / completedCount) * 10) / 10 : 0;
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error("[Compliance] DSAR statistics error:", undefined, error);
      res.status(500).json({ error: "Failed to retrieve DSAR statistics" });
    }
  }
);

export { router as complianceDataPrivacyRouter };
