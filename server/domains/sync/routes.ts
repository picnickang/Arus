import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { IStorage } from "../../storage";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface SyncRoutesConfig {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  getSyncMetrics: () => Promise<Record<string, unknown>>;
  processPendingEvents: (limit?: number) => Promise<number>;
  recordAndPublish: (category: string, action: string, type: string, data: unknown) => Promise<void>;
}

export function registerSyncRoutes(app: Express, config: SyncRoutesConfig): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    getSyncMetrics,
    processPendingEvents,
    recordAndPublish,
  } = config;

  app.get("/api/sync/health", requireOrgId, generalApiRateLimit,
    withErrorHandling("get sync health status", async (req: Request, res: Response) => {
      const metrics = await getSyncMetrics();
      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        ...metrics,
      });
    })
  );

  app.post("/api/sync/reconcile", requireOrgId, generalApiRateLimit,
    withErrorHandling("reconcile sync data", async (req: Request, res: Response) => {
      const results = {
        costSync: 0,
        eventsProcessed: 0,
        partsChecked: 0,
        timestamp: new Date().toISOString(),
      };

      results.eventsProcessed = await processPendingEvents();

      try {
        const allParts = await storage.getParts();
        results.partsChecked = allParts.length;

        for (const part of allParts) {
          try {
            await storage.syncPartCostToStock(part.id);
            results.costSync++;
          } catch (syncError: unknown) {
            const msg = syncError instanceof Error ? syncError.message : String(syncError);
            logger.warn("Sync", `Failed to sync cost for part ${part.id}`, msg);
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn("Sync", "Cost reconciliation skipped - storage method not available", msg);
      }

      await recordAndPublish("sync", "reconcile", "reconcile", results);

      res.json({
        ok: true,
        ...results,
        message: `Reconciliation completed: ${results.costSync} parts synchronized, ${results.eventsProcessed} events processed`,
      });
    })
  );

  app.post("/api/sync/process-events", requireOrgId, generalApiRateLimit,
    withErrorHandling("process sync events", async (req: Request, res: Response) => {
      const limit = Number.parseInt(req.query.limit as string) || 100;
      const processed = await processPendingEvents(limit);

      res.json({
        ok: true,
        processed,
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.get("/api/sync/metrics", requireOrgId, generalApiRateLimit,
    withErrorHandling("get sync metrics", async (req: Request, res: Response) => {
      const metrics = await getSyncMetrics();
      res.json(metrics);
    })
  );

  app.get("/api/sync/status", requireOrgId, generalApiRateLimit,
    withErrorHandling("get sync status", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { getReconciliationSummary } = await import("../../sync-jobs.js");
      const summary = await getReconciliationSummary(orgId);
      const metrics = await getSyncMetrics();

      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        sync: {
          lastRun: summary.lastRun,
          totalIssues: summary.totalIssues,
          criticalIssues: summary.criticalIssues,
          recentActivity: summary.recentActivity,
        },
        metrics,
      });
    })
  );

  app.post("/api/sync/reconcile/comprehensive", requireOrgId, generalApiRateLimit,
    withErrorHandling("comprehensive reconciliation", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { reconcileAll } = await import("../../sync-jobs.js");
      const reconciliationResult = await reconcileAll(orgId);

      await recordAndPublish("sync", "reconcile", "comprehensive", reconciliationResult);

      res.json({
        ok: reconciliationResult.success,
        ...reconciliationResult,
        message: reconciliationResult.success
          ? `Comprehensive reconciliation completed: ${reconciliationResult.stats.totalIssues} issues found across ${reconciliationResult.stats.checkedEntities} entities`
          : `Comprehensive reconciliation failed: ${reconciliationResult.issues.length} errors encountered`,
      });
    })
  );

  app.post("/api/sync/check-conflicts", requireOrgId, generalApiRateLimit,
    withErrorHandling("check conflicts", async (req: Request, res: Response) => {
      const { table, recordId, data, version, timestamp, user, device, orgId } = req.body;

      if (!table || !recordId || !data || !version || !user || !device || !orgId) {
        res.status(400).json({
          message: "Missing required fields: table, recordId, data, version, user, device, orgId",
        });
        return;
      }

      const { detectConflicts, logConflict } = await import("../../conflict-resolution-service.js");

      const result = await detectConflicts(
        table,
        recordId,
        data,
        version,
        new Date(timestamp),
        user,
        device,
        orgId
      );

      if (result.hasConflict && result.conflicts.length > 0) {
        const conflictIds = [];
        for (const conflict of result.conflicts) {
          const conflictId = await logConflict(
            conflict,
            user,
            device,
            null,
            null,
            orgId
          );
          conflictIds.push(conflictId);
        }

        await recordAndPublish("sync", "conflict", "detected", {
          table,
          recordId,
          conflictCount: conflictIds.length,
          requiresManual: result.requiresManualResolution,
        });

        res.json({
          ...result,
          conflictIds,
        });
      } else {
        res.json(result);
      }
    })
  );

  app.get("/api/sync/pending-conflicts", requireOrgId, generalApiRateLimit,
    withErrorHandling("get pending conflicts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { getPendingConflicts } = await import("../../conflict-resolution-service.js");
      const conflicts = await getPendingConflicts(orgId);

      res.json({ conflicts });
    })
  );

  app.post("/api/sync/resolve-conflict", requireOrgId, writeOperationRateLimit,
    withErrorHandling("resolve conflict", async (req: Request, res: Response) => {
      const { conflictId, resolvedValue, resolvedBy, resolutionNotes } = req.body;

      if (!conflictId || resolvedValue === undefined || !resolvedBy) {
        res.status(400).json({
          message: "Missing required fields: conflictId, resolvedValue, resolvedBy",
        });
        return;
      }

      const { manuallyResolveConflict } = await import("../../conflict-resolution-service.js");

      await manuallyResolveConflict(conflictId, resolvedValue, resolvedBy);

      await recordAndPublish("sync", "conflict", "resolved", {
        conflictId,
        resolvedBy,
        notes: resolutionNotes,
      });

      res.json({
        ok: true,
        message: "Conflict resolved successfully",
      });
    })
  );

  app.post("/api/sync/auto-resolve", requireOrgId, writeOperationRateLimit,
    withErrorHandling("auto-resolve conflicts", async (req: Request, res: Response) => {
      const { conflictIds, resolvedBy } = req.body;

      if (!conflictIds || !Array.isArray(conflictIds) || !resolvedBy) {
        res.status(400).json({
          message: "Missing required fields: conflictIds (array), resolvedBy",
        });
        return;
      }

      const { db } = await import("../../db.js");
      const { syncConflicts } = await import("@shared/sync-conflicts-schema.js");
      const { eq, and, inArray } = await import("drizzle-orm");

      const conflicts = await db
        .select()
        .from(syncConflicts)
        .where(and(inArray(syncConflicts.id, conflictIds), eq(syncConflicts.resolved, false)));

      if (conflicts.length === 0) {
        sendNotFound(res, "Unresolved conflicts");
        return;
      }

      const safetyCriticalConflicts = conflicts.filter((c) => c.isSafetyCritical);
      if (safetyCriticalConflicts.length > 0) {
        res.status(400).json({
          message: "Cannot auto-resolve safety-critical conflicts",
          safetyCriticalIds: safetyCriticalConflicts.map((c) => c.id),
        });
        return;
      }

      const { manuallyResolveConflict } = await import("../../conflict-resolution-service.js");
      const resolved: Array<{ conflictId: string; field: string; resolvedValue: unknown }> = [];

      for (const conflict of conflicts) {
        let resolvedValue;
        const localValue = conflict.localValue ? JSON.parse(conflict.localValue) : null;
        const serverValue = conflict.serverValue ? JSON.parse(conflict.serverValue) : null;

        const resolutionStrategies: Record<string, () => unknown> = {
          max: () => Math.max(Number(localValue), Number(serverValue)),
          min: () => Math.min(Number(localValue), Number(serverValue)),
          append: () => (typeof localValue === "string" && typeof serverValue === "string")
            ? `${serverValue}\n---\n${localValue}` : localValue,
          lww: () => {
            const localTime = conflict.localTimestamp?.getTime() || 0;
            const serverTime = conflict.serverTimestamp?.getTime() || 0;
            return localTime > serverTime ? localValue : serverValue;
          },
          or: () => Boolean(localValue) || Boolean(serverValue),
          server: () => serverValue,
        };
        const strategyFn = resolutionStrategies[conflict.resolutionStrategy ?? ""];
        resolvedValue = strategyFn ? strategyFn() : localValue;

        await manuallyResolveConflict(conflict.id, resolvedValue, `system:auto-${resolvedBy}`);
        resolved.push({
          conflictId: conflict.id,
          field: conflict.fieldName,
          resolvedValue,
        });
      }

      res.json({
        ok: true,
        resolved,
        resolvedCount: resolved.length,
      });
    })
  );

  logger.info("SyncRoutes", "Registered (health, reconcile, process-events, metrics, status, check-conflicts, pending-conflicts, resolve-conflict, auto-resolve)");
}
