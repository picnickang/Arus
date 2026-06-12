import { Router, Request, Response } from "express";
import { z } from "zod";
import { auditService } from "../immutable-audit.service";
import { requireAdminAuth, auditAdminAction } from "../../security";
import { DataExportImportService } from "../../services/data-export-import";
import { DataAnonymizationService } from "../data-anonymization.service";
import { requireComplianceAccess } from "./audit-routes";
import { createLogger } from "../../lib/structured-logger";
import { authenticatedRequest } from "../../middleware/auth";
import { registerDataPrivacyDsarRoutes } from "./data-privacy-dsar-routes";
const logger = createLogger("Compliance:Routes:DataPrivacyRoutes");

const router = Router();
const exportService = new DataExportImportService("./data-exports");
const anonymizationLevelSchema = z.enum(["none", "partial", "full"]);

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

function requestOrgId(req: Request): string | undefined {
  return authenticatedRequest(req).orgId;
}

function requestActorId(req: Request): string {
  const authReq = authenticatedRequest(req);
  return authReq.adminId || authReq.user?.id || "admin";
}

router.post(
  "/export/anonymized",
  requireAdminAuth,
  auditAdminAction("compliance_export_anonymized"),
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const orgId = requestOrgId(req);
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      const options = anonymizedExportSchema.parse(req.body);
      const exportedBy = requestActorId(req);
      logger.info(
        `[Compliance] Starting anonymized export for org: ${orgId}, level: ${options.anonymize}`
      );
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
          anonymize: options.anonymize,
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
        return res.json({
          success: true,
          data: {
            exportId: result.exportId,
            filePath: result.filePath,
            duration: result.duration,
            anonymizationLevel: options.anonymize,
            manifest: result.manifest,
          },
        });
      }
      return res
        .status(500)
        .json({ success: false, error: result.error, exportId: result.exportId });
    } catch (error) {
      logger.error("[Compliance] Anonymized export error:", undefined, error);
      return res.status(500).json({
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
      const orgId = requestOrgId(req);
      const { exportId } = req.params;
      if (!exportId) {
        return res.status(400).json({ error: "Missing exportId" });
      }
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
        performedBy: requestActorId(req),
        performedByType: "user",
        retentionRequired: true,
      });
      return res.download(exportPath, `${exportId}.tar.gz`);
    } catch (error) {
      logger.error("[Compliance] Export download error:", undefined, error);
      return res.status(500).json({ error: "Failed to download export" });
    }
  }
);

router.get(
  "/anonymization/preview",
  requireAdminAuth,
  requireComplianceAccess,
  async (req: Request, res: Response) => {
    try {
      const level = anonymizationLevelSchema.default("full").parse(req.query["level"]);
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
        { level, preserveIds: true, preserveTimestamps: true, preserveTechnicalData: false }
      );
      return res.json({
        success: true,
        data: { original: sampleRecord, anonymized, anonymizationResult: result, level },
      });
    } catch (error) {
      logger.error("[Compliance] Anonymization preview error:", undefined, error);
      return res.status(500).json({ error: "Failed to preview anonymization" });
    }
  }
);

registerDataPrivacyDsarRoutes(router);

export { router as complianceDataPrivacyRouter };
