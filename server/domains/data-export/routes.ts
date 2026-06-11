/**
 * Data Export/Import Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Provides data export, import, and backup management
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";

const exportBodySchema = z
  .object({
    includeTelemetry: z.boolean().optional(),
    telemetryDays: z.number().optional(),
    includeKnowledgeBase: z.boolean().optional(),
    includeAuditLogs: z.boolean().optional(),
  })
  .partial();
const importBodySchema = z
  .object({
    dryRun: z.string().optional(),
    skipTelemetry: z.string().optional(),
    conflictResolution: z.enum(["replace", "skip", "upsert"]).optional(),
  })
  .partial();
const exportIdParamSchema = z.object({ exportId: z.string().min(1) });
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import { authenticatedRequest } from "../../middleware/auth";
import { getDataExportImportService } from "../../services/data-export-import";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface DataExportDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: import("express").RequestHandler;
  auditAdminAction: (action: string) => import("express").RequestHandler;
  upload: { single: (field: string) => import("express").RequestHandler };
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
      const exportedBy = authenticatedRequest(req).user?.id || "admin";

      const body = exportBodySchema.parse(req.body ?? {});
      const result = await service.exportOrg(
        orgId,
        {
          includeTelemetry: body.includeTelemetry ?? false,
          telemetryDays: body.telemetryDays ?? 30,
          includeKnowledgeBase: body.includeKnowledgeBase ?? true,
          includeAuditLogs: body.includeAuditLogs ?? false,
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
      const { exportId } = exportIdParamSchema.parse(req.params);
      const service = getDataExportImportService();
      const exports = await service.listExports();
      const exportFile = exports.find((e) => e.id === exportId);

      if (!exportFile) {
        return sendNotFound(res, "Export");
      }

      const fs = await import("fs");

      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${exportId}.tar.gz"`);

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
        exports.map((e) => ({
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
      const { exportId } = exportIdParamSchema.parse(req.params);
      const service = getDataExportImportService();
      const deleted = await service.deleteExport(exportId);

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

      const fs = await import("node:fs/promises");

      const body = importBodySchema.parse(req.body ?? {});
      try {
        const result = await service.importData(req.file.path, {
          targetOrgId: DEFAULT_ORG_ID,
          dryRun: body.dryRun === "true",
          skipTelemetry: body.skipTelemetry === "true",
          conflictResolution: body.conflictResolution || "upsert",
        });

        return res.json(result);
      } finally {
        await fs.unlink(req.file.path).catch(() => undefined);
      }
    })
  );

  logger.info("DataExportRoutes", "Registered (export: 2, import: 1, list: 2)");
}
