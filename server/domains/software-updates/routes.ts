/**
 * Software Updates Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Provides update checking, patch management, and rollback functionality
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, handleApiError } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface SoftwareUpdatesDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: import("express").RequestHandler[];
  auditAdminAction: (action: string) => any;
}

export function registerSoftwareUpdatesRoutes(
  app: Express,
  deps: SoftwareUpdatesDependencies
): void {
  const {
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/updates/check",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("CHECK_FOR_UPDATES"),
    withErrorHandling("check for updates", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const orgId = DEFAULT_ORG_ID;
      const { channel } = req.query;

      const manifest = await updateChecker.checkForUpdates(orgId, (channel as string) || "stable");

      if (manifest) {
        const patch = await updateChecker.registerPatch(orgId, manifest);

        const { wsServer } = await import("../../websocket");
        wsServer.broadcast("update_available", {
          type: "update_available",
          version: manifest.version,
          severity: manifest.severity,
          patchId: patch.id,
        });

        res.json({ available: true, manifest, patchId: patch.id });
      } else {
        res.json({ available: false });
      }
    })
  );

  app.get(
    "/api/admin/patches",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PATCHES"),
    withErrorHandling("fetch patches", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const orgId = DEFAULT_ORG_ID;

      const patches = await updateChecker.getAvailablePatches(orgId);
      res.json(patches);
    })
  );

  app.get(
    "/api/admin/patches/history",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PATCH_HISTORY"),
    withErrorHandling("fetch patch history", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const orgId = DEFAULT_ORG_ID;
      const { limit } = req.query;

      const patches = await updateChecker.getPatchHistory(
        orgId,
        limit ? Number.parseInt(limit as string) : 50
      );
      res.json(patches);
    })
  );

  app.post(
    "/api/admin/patches/:id/download",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("DOWNLOAD_PATCH"),
    withErrorHandling("download patch", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const { id } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const patchPath = await updateChecker.downloadPatch(id, orgId);

      res.json({
        success: true,
        patchId: id,
        path: patchPath,
      });
    })
  );

  app.post(
    "/api/admin/patches/:id/apply",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("APPLY_PATCH"),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
        const { patchApplicator } = await import("../../services/patch-applicator");
        const { patchPath } = req.body;

        if (!patchPath) {
          return res.status(400).json({ error: "Patch path is required" });
        }

        const { wsServer } = await import("../../websocket");
        const startTimestamp = new Date().toISOString();
        wsServer.broadcastUpdateNotification({
          id: `patch-started-${id}-${Date.now()}`,
          type: "update_started",
          message: `Patch ${id} is being applied...`,
          severity: "info",
          timestamp: startTimestamp,
          metadata: {
            patchId: id,
            initiatedBy: (req as AuthenticatedRequest).user?.id,
          },
        });

        const result = await patchApplicator.applyPatch(
          id,
          patchPath,
          (req as AuthenticatedRequest).user?.id
        );

        if (result.success) {
          wsServer.broadcastUpdateNotification({
            id: `patch-applied-${id}-${Date.now()}`,
            type: "update_completed",
            message: `Patch ${id} was successfully applied. Restart may be required.`,
            severity: "info",
            metadata: {
              patchId: id,
              appliedBy: (req as AuthenticatedRequest).user?.id,
              requiresRestart: true,
            },
          });
        } else {
          wsServer.broadcastUpdateNotification({
            id: `patch-failed-${id}-${Date.now()}`,
            type: "update_failed",
            message: `Patch ${id} application failed: ${result.error || "Unknown error"}`,
            severity: "critical",
            metadata: {
              patchId: id,
              error: result.error,
            },
          });
        }

        res.json(result);
      } catch (error) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcastUpdateNotification({
          id: `patch-error-${id}-${Date.now()}`,
          type: "update_failed",
          message: `Patch application encountered an error`,
          severity: "critical",
          metadata: {
            patchId: id,
            error: String(error),
          },
        });
        handleApiError(res, error, "apply patch");
      }
    }
  );

  app.post(
    "/api/admin/patches/rollback/:backupId",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("ROLLBACK_PATCH"),
    async (req: Request, res: Response) => {
      const { backupId } = req.params;
      try {
        const { patchApplicator } = await import("../../services/patch-applicator");

        await patchApplicator.rollback(backupId);

        const { wsServer } = await import("../../websocket");
        wsServer.broadcastUpdateNotification({
          id: `rollback-${backupId}-${Date.now()}`,
          type: "update_rollback",
          message: `System has been rolled back to backup ${backupId}`,
          severity: "warning",
          metadata: {
            backupId,
            rolledBackBy: (req as AuthenticatedRequest).user?.id,
          },
        });

        res.json({ success: true, backupId });
      } catch (error) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcastUpdateNotification({
          id: `rollback-error-${backupId}-${Date.now()}`,
          type: "update_failed",
          message: `Rollback to backup ${backupId} failed`,
          severity: "critical",
          metadata: {
            backupId,
            error: String(error),
          },
        });
        handleApiError(res, error, "rollback patch");
      }
    }
  );

  app.get(
    "/api/admin/backups",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_BACKUPS"),
    withErrorHandling("list backups", async (req: Request, res: Response) => {
      const { patchApplicator } = await import("../../services/patch-applicator");
      const backups = patchApplicator.listBackups();
      res.json(backups);
    })
  );

  logger.info("SoftwareUpdatesRoutes", "Registered (updates: 1, patches: 5, backups: 1)");
}
