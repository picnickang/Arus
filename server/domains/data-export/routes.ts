/**
 * Data Export/Import Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Provides data export, import, and backup management
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { getDataExportImportService } from "../../services/data-export-import";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface DataExportDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
  upload: any;
}

export function registerDataExportRoutes(app: Express, deps: DataExportDependencies): void {
  const {
    generalApiRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    upload,
  } = deps;

  // Export org data
  app.post(
    "/api/admin/export",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("EXPORT_DATA"),
    withErrorHandling("export data", async (req: Request, res: Response) => {
      const service = getDataExportImportService();
      const orgId = DEFAULT_ORG_ID;
      const exportedBy = (req as AuthenticatedRequest).user?.id || "admin";

      const result = await service.exportOrg(
        orgId,
        {
          includeTelemetry: req.body.includeTelemetry ?? false,
          telemetryDays: req.body.telemetryDays ?? 30,
          includeKnowledgeBase: req.body.includeKnowledgeBase ?? true,
          includeAuditLogs: req.body.includeAuditLogs ?? false,
        },
        exportedBy
      );

      if (result.success) {
        res.json({
          success: true,
          exportId: result.exportId,
          downloadUrl: `/api/admin/export/download/${result.exportId}`,
          manifest: result.manifest,
          duration: result.duration,
        });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    })
  );

  // Download export file
  app.get(
    "/api/admin/export/download/:exportId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("DOWNLOAD_EXPORT"),
    withErrorHandling("download export", async (req: Request, res: Response) => {
      const service = getDataExportImportService();
      const exports = await service.listExports();
      const exportFile = exports.find((e: any) => e.id === req.params.exportId);

      if (!exportFile) {
        return sendNotFound(res, "Export");
      }

      const fs = await import("fs");

      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.exportId}.tar.gz"`);

      const fileStream = fs.createReadStream(exportFile.path);
      fileStream.pipe(res);
    })
  );

  // List available exports
  app.get(
    "/api/admin/exports",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_EXPORTS"),
    withErrorHandling("list exports", async (req: Request, res: Response) => {
      const service = getDataExportImportService();
      const exports = await service.listExports();

      res.json(
        exports.map((e: any) => ({
          id: e.id,
          createdAt: e.createdAt,
          size: e.size,
          downloadUrl: `/api/admin/export/download/${e.id}`,
        }))
      );
    })
  );

  // Delete an export
  app.delete(
    "/api/admin/export/:exportId",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_EXPORT"),
    withErrorHandling("delete export", async (req: Request, res: Response) => {
      const service = getDataExportImportService();
      const deleted = await service.deleteExport(req.params.exportId);

      if (deleted) {
        res.json({ success: true });
      } else {
        sendNotFound(res, "Export");
      }
    })
  );

  // Import data (file upload)
  app.post(
    "/api/admin/import",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("IMPORT_DATA"),
    upload.single("file"),
    withErrorHandling("import data", async (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const service = getDataExportImportService();

      const result = await service.importData(req.file.path, {
        targetOrgId: DEFAULT_ORG_ID,
        dryRun: req.body.dryRun === "true",
        skipTelemetry: req.body.skipTelemetry === "true",
        conflictResolution: req.body.conflictResolution || "upsert",
      });

      const fs = await import("fs");
      fs.unlinkSync(req.file.path);

      res.json(result);
    })
  );

  logger.info("DataExportRoutes", "Registered (export: 2, import: 1, list: 2)");
}
