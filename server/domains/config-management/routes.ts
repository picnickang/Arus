/**
 * Configuration Management Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Provides hot config reload, config CRUD, and config audit
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import { authenticatedRequest } from "../../middleware/auth";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

interface ConfigManagementDependencies {
  db: typeof import("../../db").db;
  configAuditLog: typeof import("@shared/schema/admin").configAuditLog;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: import("express").RequestHandler[];
  auditAdminAction: (action: string) => import("express").RequestHandler;
}

export function registerConfigManagementRoutes(
  app: Express,
  deps: ConfigManagementDependencies
): void {
  const {
    db,
    configAuditLog,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/config/reload",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RELOAD_CONFIGURATION"),
    withErrorHandling("reload configuration", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const orgId = DEFAULT_ORG_ID;

      const result = await configManager.reloadConfig({
        orgId,
        changedBy: authenticatedRequest(req).user?.id,
        changedByName: authenticatedRequest(req).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        autoReload: false,
      });

      if (result.success && result.changed.length > 0) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast("config", {
          type: "config_updated",
          timestamp: new Date().toISOString(),
          changesCount: result.changed.length,
          requiresRestart: result.requiresRestart,
        });
      }

      return res.json(result);
    })
  );

  app.get(
    "/api/admin/config",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIGURATION"),
    withErrorHandling("get configuration", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const config = configManager.getAll();

      const sanitized: Record<string, string> = {};
      const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"];

      for (const [key, value] of Object.entries(config)) {
        if (sensitiveKeys.some((s) => key.includes(s))) {
          sanitized[key] = "***REDACTED***";
        } else {
          sanitized[key] = value;
        }
      }

      return res.json({ config: sanitized });
    })
  );

  // Literal route declared before the `/:key` param route so it is not
  // captured as key="audit".
  app.get(
    "/api/admin/config/audit",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIG_AUDIT"),
    withErrorHandling("fetch config audit log", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { key, limit } = req.query;

      const auditLogs = await db
        .select()
        .from(configAuditLog)
        .where(
          key
            ? sql`${configAuditLog.orgId} = ${orgId} AND ${configAuditLog.key} = ${key}`
            : sql`${configAuditLog.orgId} = ${orgId}`
        )
        .orderBy(sql`${configAuditLog.changedAt} DESC`)
        .limit(limit ? Number.parseInt(limit as string) : 100);

      return res.json(auditLogs);
    })
  );

  app.get(
    "/api/admin/config/:key",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIG_VALUE"),
    withErrorHandling("get configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key = "" } = req.params;
      const value = configManager.get(key);
      const isCritical = configManager.isCritical(key);

      if (value === undefined) {
        return res.status(404).json({ error: "Configuration key not found" });
      }

      const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"];
      const isSensitive = sensitiveKeys.some((s) => key.includes(s));

      return res.json({
        key,
        value: isSensitive ? "***REDACTED***" : value,
        isCritical,
        isSensitive,
      });
    })
  );

  app.put(
    "/api/admin/config/:key",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_CONFIG_VALUE"),
    withErrorHandling("update configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key = "" } = req.params;
      const { value } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).json({ error: "Value is required" });
      }

      const orgId = DEFAULT_ORG_ID;

      const result = await configManager.set(key, String(value), {
        orgId,
        changedBy: authenticatedRequest(req).user?.id,
        changedByName: authenticatedRequest(req).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (result.success) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast("config", {
          type: "config_updated",
          timestamp: new Date().toISOString(),
          key,
          requiresRestart: result.requiresRestart,
        });
      }

      return res.json(result);
    })
  );

  app.delete(
    "/api/admin/config/:key",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_CONFIG_VALUE"),
    withErrorHandling("delete configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key = "" } = req.params;
      const orgId = DEFAULT_ORG_ID;

      const result = await configManager.delete(key, {
        orgId,
        changedBy: authenticatedRequest(req).user?.id,
        changedByName: authenticatedRequest(req).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (result.success) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast("config", {
          type: "config_updated",
          timestamp: new Date().toISOString(),
          key,
          deleted: true,
          requiresRestart: result.requiresRestart,
        });
      }

      return res.json(result);
    })
  );

  logger.info("ConfigManagementRoutes", "Registered (reload: 1, config: 4, audit: 1)");
}
