# ARUS System Administration — All Backend Route Files

Generated: 2026-03-26T02:26:50Z

These files power the System Administration page tabs:
- Configuration, Scheduling, Updates & Maintenance, Monitoring & Health, Audit & Compliance, ML & Testing

---

## `server/domains/system-admin/routes/types.ts` (67 lines)

```ts
/**
 * System Admin Routes - Shared Types
 * Common interfaces and dependencies for all system admin route modules
 */

import type { Express } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";

export type { Express, Request, Response };

export interface IStorage {
  getUserByEmail: (email: string, orgId: string) => Promise<any>;
  createUser: (data: any) => Promise<any>;
  createAdminSession: (data: any) => Promise<any>;
  invalidateAllAdminSessions: () => Promise<void>;
  getAdminAuditEvents: (orgId?: string, action?: string, limit?: number) => Promise<any[]>;
  createAdminAuditEvent: (data: any) => Promise<any>;
  getAuditEventsByUser: (userId: string, orgId?: string) => Promise<any[]>;
  getAuditEventsByResource: (resourceType: string, resourceId: string, orgId?: string) => Promise<any[]>;
  getAdminSystemSettings: (orgId?: string, category?: string) => Promise<any[]>;
  getAdminSystemSetting: (orgId: string, category: string, key: string) => Promise<any>;
  createAdminSystemSetting: (data: any) => Promise<any>;
  updateAdminSystemSetting: (id: string, data: any) => Promise<any>;
  deleteAdminSystemSetting: (id: string) => Promise<void>;
  getSettingsByCategory: (orgId: string, category: string) => Promise<any[]>;
  getIntegrationConfigs: (orgId?: string, type?: string) => Promise<any[]>;
  getIntegrationConfig: (id: string, orgId?: string) => Promise<any>;
  createIntegrationConfig: (data: any) => Promise<any>;
  updateIntegrationConfig: (id: string, data: any) => Promise<any>;
  deleteIntegrationConfig: (id: string) => Promise<void>;
  updateIntegrationHealth: (id: string, healthStatus: string, errorMessage?: string) => Promise<any>;
  getMaintenanceWindows: (orgId?: string, status?: string) => Promise<any[]>;
  getMaintenanceWindow: (id: string, orgId?: string) => Promise<any>;
  createMaintenanceWindow: (data: any) => Promise<any>;
  updateMaintenanceWindow: (id: string, data: any) => Promise<any>;
  deleteMaintenanceWindow: (id: string) => Promise<void>;
  getActiveMaintenanceWindows: (orgId?: string) => Promise<any[]>;
  getSystemPerformanceMetrics: (orgId?: string, category?: string, hours?: number) => Promise<any[]>;
  createSystemPerformanceMetric: (data: any) => Promise<any>;
  getLatestMetricsByCategory: (orgId: string, category: string) => Promise<any[]>;
  getMetricTrends: (orgId: string, metricName: string, hours?: number) => Promise<any[]>;
}

export interface ThresholdCalibrator {
  calibrateForEquipment: (orgId: string, equipmentId: string) => Promise<any>;
}

export interface SystemAdminDependencies {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
  thresholdCalibrator: ThresholdCalibrator;
  adminPasswordVerifySchema: z.ZodSchema;
  adminPasswordChangeSchema: z.ZodSchema;
  insertAdminAuditEventSchema: z.ZodSchema;
  insertAdminSystemSettingSchema: z.ZodSchema;
  insertIntegrationConfigSchema: z.ZodSchema;
  insertMaintenanceWindowSchema: z.ZodSchema;
  insertSystemPerformanceMetricSchema: z.ZodSchema;
  AdminSessionResponse: any;
}

export { z };

```

---

## `server/domains/system-admin/routes/index.ts` (42 lines)

```ts
/**
 * System Admin Routes - Index Aggregator
 * Combines all modular system admin route handlers
 */

import type { Express } from "express";
import type { SystemAdminDependencies, IStorage, ThresholdCalibrator } from "./types.js";
import { logger } from "../../../utils/logger.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerAuditRoutes } from "./audit-routes.js";
import { registerSettingsRoutes } from "./settings-routes.js";
import { registerSimulationRoutes } from "./simulation-routes.js";
import { registerIntegrationsRoutes } from "./integrations-routes.js";
import { registerWindowsRoutes } from "./windows-routes.js";
import { registerMetricsRoutes } from "./metrics-routes.js";

export type { SystemAdminDependencies, IStorage, ThresholdCalibrator };

export function registerSystemAdminRoutes(
  app: Express,
  deps: SystemAdminDependencies
): void {
  registerAuthRoutes(app, deps);
  registerAuditRoutes(app, deps);
  registerSettingsRoutes(app, deps);
  registerSimulationRoutes(app, deps);
  registerIntegrationsRoutes(app, deps);
  registerWindowsRoutes(app, deps);
  registerMetricsRoutes(app, deps);

  logger.info("SystemAdminRoutes", "Registered (auth: 2, audit: 4, settings: 7, integrations: 7, windows: 7, metrics: 4, simulation: 4)");
}

export {
  registerAuthRoutes,
  registerAuditRoutes,
  registerSettingsRoutes,
  registerSimulationRoutes,
  registerIntegrationsRoutes,
  registerWindowsRoutes,
  registerMetricsRoutes,
};

```

---

## `server/domains/system-admin/routes/auth-routes.ts` (261 lines)

```ts
/**
 * System Admin Routes - Authentication
 * Admin login verification and password management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerAuthRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    adminPasswordVerifySchema,
    adminPasswordChangeSchema,
  } = deps;

  app.post(
    "/api/admin/auth/verify",
    generalApiRateLimit,
    withErrorHandling("verify admin authentication", async (req: Request, res: Response) => {
      const { password } = adminPasswordVerifySchema.parse(req.body);

      const validAdminToken = process.env.ADMIN_TOKEN;

      if (!validAdminToken) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (password !== validAdminToken) {
        logger.warn("AdminAuth", `Failed admin password verification from ${req.ip}`);
        res.status(401).json({
          error: "Invalid password",
          code: "INVALID_PASSWORD",
        });
        return;
      }

      const crypto = await import("crypto");
      const sessionToken = crypto.randomBytes(32).toString("hex");

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const mockOrgId = "default-org-id";
      let adminUser = await storage.getUserByEmail("admin@example.com", mockOrgId);

      if (!adminUser) {
        adminUser = await storage.createUser({
          orgId: mockOrgId,
          email: "admin@example.com",
          name: "System Administrator",
          role: "admin",
          isActive: true,
        });
      }

      await storage.createAdminSession({
        orgId: mockOrgId,
        sessionToken,
        userId: adminUser.id,
        adminEmail: "admin@example.com",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        expiresAt,
        lastActivityAt: new Date(),
      });

      logger.info("AdminAuth", `Admin session created from ${req.ip}`);

      const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      res.json({
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        expiresIn,
      });
    })
  );

  app.get(
    "/api/admin/auth/status",
    generalApiRateLimit,
    withErrorHandling("check admin auth status", async (_req: Request, res: Response) => {
      const configured = !!process.env.ADMIN_TOKEN;
      res.json({ configured });
    })
  );

  app.post(
    "/api/admin/auth/setup",
    criticalOperationRateLimit,
    withErrorHandling("initial admin password setup", async (req: Request, res: Response) => {
      if (process.env.ADMIN_TOKEN) {
        res.status(409).json({
          error: "Admin password is already configured",
          code: "ALREADY_CONFIGURED",
        });
        return;
      }

      const { password } = adminPasswordVerifySchema.parse(req.body);

      if (!password || password.length < 8) {
        res.status(400).json({
          error: "Password must be at least 8 characters",
          code: "PASSWORD_TOO_SHORT",
        });
        return;
      }

      if (/[\r\n\0]/.test(password)) {
        res.status(400).json({
          error: "Password contains invalid characters",
          code: "INVALID_CHARACTERS",
        });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        let envContent = "";
        try {
          envContent = await fs.readFile(envPath, "utf-8");
        } catch {
          envContent = "";
        }

        const finalContent = envContent
          ? `${envContent.trimEnd()}\nADMIN_TOKEN=${password}\n`
          : `ADMIN_TOKEN=${password}\n`;

        await fs.writeFile(envPath, finalContent, "utf-8");
        process.env.ADMIN_TOKEN = password;

        const crypto = await import("crypto");
        const sessionToken = crypto.randomBytes(32).toString("hex");

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        const mockOrgId = "default-org-id";
        let adminUser = await storage.getUserByEmail("admin@example.com", mockOrgId);

        if (!adminUser) {
          adminUser = await storage.createUser({
            orgId: mockOrgId,
            email: "admin@example.com",
            name: "System Administrator",
            role: "admin",
            isActive: true,
          });
        }

        await storage.createAdminSession({
          orgId: mockOrgId,
          sessionToken,
          userId: adminUser.id,
          adminEmail: "admin@example.com",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          expiresAt,
          lastActivityAt: new Date(),
        });

        logger.info("AdminAuth", `Initial admin password configured from ${req.ip}`);

        const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
        res.json({
          success: true,
          sessionToken,
          expiresAt: expiresAt.toISOString(),
          expiresIn,
        });
      } catch (fileError) {
        logger.error("AdminAuth", "Failed to write .env file during setup", fileError);
        res.status(500).json({
          error: "Failed to persist admin password",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );

  app.post(
    "/api/admin/auth/change-password",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CHANGE_ADMIN_PASSWORD"),
    withErrorHandling("change admin password", async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = adminPasswordChangeSchema.parse(req.body);

      const validAdminToken = process.env.ADMIN_TOKEN;

      if (!validAdminToken) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (currentPassword !== validAdminToken) {
        logger.warn("AdminAuth", `Failed admin password change attempt from ${req.ip}`);
        res.status(401).json({
          error: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        const envContent = await fs.readFile(envPath, "utf-8");

        const updatedContent = envContent.replace(
          /^ADMIN_TOKEN=.*/m,
          `ADMIN_TOKEN=${newPassword}`
        );

        const finalContent = updatedContent.includes("ADMIN_TOKEN=")
          ? updatedContent
          : `${updatedContent}\nADMIN_TOKEN=${newPassword}\n`;

        await fs.writeFile(envPath, finalContent, "utf-8");

        process.env.ADMIN_TOKEN = newPassword;

        await storage.invalidateAllAdminSessions();

        logger.info("AdminAuth", `Admin password changed successfully from ${req.ip}`);

        res.json({
          success: true,
          message:
            "Password changed successfully. All admin sessions have been invalidated. Please log in again with your new password.",
        });
      } catch (fileError) {
        logger.error("AdminAuth", "Failed to update .env file", fileError);
        res.status(500).json({
          error:
            "Failed to persist password change. Please update ADMIN_TOKEN in your environment secrets manually.",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );
}

```

---

## `server/domains/system-admin/routes/audit-routes.ts` (76 lines)

```ts
/**
 * System Admin Routes - Audit Events
 * Admin audit event logging and retrieval
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";

export function registerAuditRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertAdminAuditEventSchema,
  } = deps;

  app.get(
    "/api/admin/audit",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_AUDIT_EVENTS"),
    withErrorHandling("fetch admin audit events", async (req: Request, res: Response) => {
      const { orgId, action, limit } = req.query;
      const events = await storage.getAdminAuditEvents(
        orgId as string,
        action as string,
        limit ? Number.parseInt(limit as string) : undefined
      );
      res.json(events);
    })
  );

  app.post(
    "/api/admin/audit",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_AUDIT_EVENT"),
    withErrorHandling("create admin audit event", async (req: Request, res: Response) => {
      const validatedData = insertAdminAuditEventSchema.parse(req.body);
      const event = await storage.createAdminAuditEvent(validatedData);
      sendCreated(res, event);
    })
  );

  app.get(
    "/api/admin/audit/user/:userId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_USER_AUDIT_EVENTS"),
    withErrorHandling("fetch user audit events", async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { orgId } = req.query;
      const events = await storage.getAuditEventsByUser(userId, orgId as string);
      res.json(events);
    })
  );

  app.get(
    "/api/admin/audit/resource/:resourceType/:resourceId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_RESOURCE_AUDIT_EVENTS"),
    withErrorHandling("fetch resource audit events", async (req: Request, res: Response) => {
      const { resourceType, resourceId } = req.params;
      const { orgId } = req.query;
      const events = await storage.getAuditEventsByResource(
        resourceType,
        resourceId,
        orgId as string
      );
      res.json(events);
    })
  );
}

```

---

## `server/domains/system-admin/routes/settings-routes.ts` (138 lines)

```ts
/**
 * System Admin Routes - System Settings
 * Admin system settings CRUD and ML threshold calibration
 */

import { Express, Request, Response, z, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerSettingsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    thresholdCalibrator,
    insertAdminSystemSettingSchema,
  } = deps;

  app.get(
    "/api/admin/settings",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SYSTEM_SETTINGS"),
    withErrorHandling("fetch admin system settings", async (req: Request, res: Response) => {
      const { orgId, category } = req.query;
      const settings = await storage.getAdminSystemSettings(orgId as string, category as string);
      res.json(settings);
    })
  );

  app.get(
    "/api/admin/settings/:orgId/:category/:key",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SYSTEM_SETTING"),
    withErrorHandling("fetch admin system setting", async (req: Request, res: Response) => {
      const { orgId, category, key } = req.params;
      const setting = await storage.getAdminSystemSetting(orgId, category, key);
      if (!setting) {
        return sendNotFound(res, "System setting");
      }
      res.json(setting);
    })
  );

  app.post(
    "/api/admin/settings",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_SYSTEM_SETTING"),
    withErrorHandling("create admin system setting", async (req: Request, res: Response) => {
      const validatedData = insertAdminSystemSettingSchema.parse(req.body);
      const setting = await storage.createAdminSystemSetting(validatedData);
      sendCreated(res, setting);
    })
  );

  app.put(
    "/api/admin/settings/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_SYSTEM_SETTING"),
    withErrorHandling("update admin system setting", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertAdminSystemSettingSchema.partial().parse(req.body);
      const setting = await storage.updateAdminSystemSetting(id, validatedData);
      res.json(setting);
    })
  );

  app.delete(
    "/api/admin/settings/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_SYSTEM_SETTING"),
    withErrorHandling("delete admin system setting", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteAdminSystemSetting(id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/admin/settings/:orgId/:category",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SETTINGS_BY_CATEGORY"),
    withErrorHandling("fetch settings by category", async (req: Request, res: Response) => {
      const { orgId, category } = req.params;
      const settings = await storage.getSettingsByCategory(orgId, category);
      res.json(settings);
    })
  );

  app.post(
    "/api/admin/calibrate-threshold",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CALIBRATE_ML_THRESHOLD"),
    withErrorHandling("calibrate ML threshold", async (req: Request, res: Response) => {
      const calibrationSchema = z.object({
        equipmentId: z.string().min(1, "Equipment ID is required"),
      });

      const { equipmentId } = calibrationSchema.parse(req.body);

      const orgId = (req as Request & { session?: { orgId?: string } }).session?.orgId;
      if (!orgId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      logger.info("AdminSettings", `Calibrating threshold for equipment ${equipmentId} (org: ${orgId})`);

      const result = await thresholdCalibrator.calibrateForEquipment(orgId, equipmentId);

      try {
        const { realtimePredictionEngine } = await import("../../../ml-realtime-prediction.js");
        realtimePredictionEngine.invalidateThresholdCache(equipmentId);
      } catch (cacheError) {
        logger.warn("AdminSettings", "Could not invalidate threshold cache", cacheError);
      }

      res.status(200).json({
        success: true,
        equipmentId,
        threshold: result.threshold,
        sampleCount: result.sampleCount,
        statistics: result.statistics,
        calibratedAt: result.calibratedAt,
        method: result.method,
      });
    })
  );
}

```

---

## `server/domains/system-admin/routes/integrations-routes.ts` (97 lines)

```ts
/**
 * System Admin Routes - Integration Configs
 * External integration configuration management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";

export function registerIntegrationsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertIntegrationConfigSchema,
  } = deps;

  app.get(
    "/api/admin/integrations",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_INTEGRATION_CONFIGS"),
    withErrorHandling("fetch integration configs", async (req: Request, res: Response) => {
      const { orgId, type } = req.query;
      const integrations = await storage.getIntegrationConfigs(orgId as string, type as string);
      res.json(integrations);
    })
  );

  app.get(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_INTEGRATION_CONFIG"),
    withErrorHandling("fetch integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { orgId } = req.query;
      const integration = await storage.getIntegrationConfig(id, orgId as string);
      if (!integration) {
        return sendNotFound(res, "Integration config");
      }
      res.json(integration);
    })
  );

  app.post(
    "/api/admin/integrations",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_INTEGRATION_CONFIG"),
    withErrorHandling("create integration config", async (req: Request, res: Response) => {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      const integration = await storage.createIntegrationConfig(validatedData);
      sendCreated(res, integration);
    })
  );

  app.put(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_INTEGRATION_CONFIG"),
    withErrorHandling("update integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertIntegrationConfigSchema.partial().parse(req.body);
      const integration = await storage.updateIntegrationConfig(id, validatedData);
      res.json(integration);
    })
  );

  app.delete(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_INTEGRATION_CONFIG"),
    withErrorHandling("delete integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteIntegrationConfig(id);
      sendDeleted(res);
    })
  );

  app.patch(
    "/api/admin/integrations/:id/health",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_INTEGRATION_HEALTH"),
    withErrorHandling("update integration health", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { healthStatus, errorMessage } = req.body;
      const integration = await storage.updateIntegrationHealth(id, healthStatus, errorMessage);
      res.json(integration);
    })
  );
}

```

---

## `server/domains/system-admin/routes/windows-routes.ts` (96 lines)

```ts
/**
 * System Admin Routes - Maintenance Windows
 * Scheduled maintenance window management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";

export function registerWindowsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertMaintenanceWindowSchema,
  } = deps;

  app.get(
    "/api/admin/maintenance-windows",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOWS"),
    withErrorHandling("fetch maintenance windows", async (req: Request, res: Response) => {
      const { orgId, status } = req.query;
      const windows = await storage.getMaintenanceWindows(orgId as string, status as string);
      res.json(windows);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOW"),
    withErrorHandling("fetch maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { orgId } = req.query;
      const window = await storage.getMaintenanceWindow(id, orgId as string);
      if (!window) {
        return sendNotFound(res, "Maintenance window");
      }
      res.json(window);
    })
  );

  app.post(
    "/api/admin/maintenance-windows",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_MAINTENANCE_WINDOW"),
    withErrorHandling("create maintenance window", async (req: Request, res: Response) => {
      const validatedData = insertMaintenanceWindowSchema.parse(req.body);
      const window = await storage.createMaintenanceWindow(validatedData);
      sendCreated(res, window);
    })
  );

  app.put(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_MAINTENANCE_WINDOW"),
    withErrorHandling("update maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertMaintenanceWindowSchema.partial().parse(req.body);
      const window = await storage.updateMaintenanceWindow(id, validatedData);
      res.json(window);
    })
  );

  app.delete(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_MAINTENANCE_WINDOW"),
    withErrorHandling("delete maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteMaintenanceWindow(id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/active",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_ACTIVE_MAINTENANCE_WINDOWS"),
    withErrorHandling("fetch active maintenance windows", async (req: Request, res: Response) => {
      const { orgId } = req.query;
      const windows = await storage.getActiveMaintenanceWindows(orgId as string);
      res.json(windows);
    })
  );
}

```

---

## `server/domains/system-admin/routes/metrics-routes.ts` (75 lines)

```ts
/**
 * System Admin Routes - Performance Metrics
 * System performance monitoring and trends
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";

export function registerMetricsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertSystemPerformanceMetricSchema,
  } = deps;

  app.get(
    "/api/admin/performance-metrics",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PERFORMANCE_METRICS"),
    withErrorHandling("fetch system performance metrics", async (req: Request, res: Response) => {
      const { orgId, category, hours } = req.query;
      const metrics = await storage.getSystemPerformanceMetrics(
        orgId as string,
        category as string,
        hours ? Number.parseInt(hours as string) : undefined
      );
      res.json(metrics);
    })
  );

  app.post(
    "/api/admin/performance-metrics",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_PERFORMANCE_METRIC"),
    withErrorHandling("create system performance metric", async (req: Request, res: Response) => {
      const validatedData = insertSystemPerformanceMetricSchema.parse(req.body);
      const metric = await storage.createSystemPerformanceMetric(validatedData);
      sendCreated(res, metric);
    })
  );

  app.get(
    "/api/admin/performance-metrics/:orgId/:category/latest",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_LATEST_METRICS"),
    withErrorHandling("fetch latest performance metrics", async (req: Request, res: Response) => {
      const { orgId, category } = req.params;
      const metrics = await storage.getLatestMetricsByCategory(orgId, category);
      res.json(metrics);
    })
  );

  app.get(
    "/api/admin/performance-metrics/:orgId/:metricName/trends",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_METRIC_TRENDS"),
    withErrorHandling("fetch metric trends", async (req: Request, res: Response) => {
      const { orgId, metricName } = req.params;
      const { hours } = req.query;
      const trends = await storage.getMetricTrends(
        orgId,
        metricName,
        hours ? Number.parseInt(hours as string) : 24
      );
      res.json(trends);
    })
  );
}

```

---

## `server/domains/system-admin/routes/simulation-routes.ts` (173 lines)

```ts
/**
 * System Admin Routes - Telemetry Simulation
 * Vessel telemetry simulation and stress testing
 */

import { Express, Request, Response, z, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerSimulationRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/simulate-telemetry",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("SIMULATE_TELEMETRY"),
    withErrorHandling("generate simulated telemetry", async (req: Request, res: Response) => {
      const { orgId } = req.body;

      if (!orgId) {
        res.status(400).json({ error: "orgId is required" });
        return;
      }

      const simulationConfigSchema = z.object({
        orgId: z.string(),
        vesselType: z.enum([
          "tug",
          "workboat",
          "pilot",
          "psv",
          "ahts",
          "crewboat",
          "survey",
          "multicat",
          "lct",
          "bunker",
          "errv",
        ]),
        equipmentId: z.string(),
        deviceId: z.string(),
        durationMinutes: z.number().min(1).max(480).default(60),
        samplingIntervalSeconds: z.number().min(1).max(60).default(1),
        injectFault: z.boolean().optional(),
        faultStartMinute: z.number().optional(),
        faultSeverity: z.number().min(0).max(1).optional(),
        signals: z.array(z.string()).optional(),
      });

      const config = simulationConfigSchema.parse(req.body);

      logger.info("AdminSimulation", `Generating simulated telemetry for ${config.vesselType} (${config.durationMinutes} min)`);

      const { getVesselSimulator } = await import("../../../vessel-simulator.js");
      const simulator = getVesselSimulator();

      const result = await simulator.simulateAndIngest(config);

      sendCreated(res, {
        success: true,
        vesselType: result.vesselType,
        equipmentId: result.equipmentId,
        pointsGenerated: result.dataPoints.length,
        statistics: result.statistics,
        message: `Successfully generated ${result.dataPoints.length} telemetry points`,
      });
    })
  );

  app.get(
    "/api/admin/vessel-types",
    requireAdminAuth,
    generalApiRateLimit,
    withErrorHandling("fetch vessel types", async (req: Request, res: Response) => {
      const { VESSEL_TYPE_PRESETS } = await import("../../../vessel-simulator-types.js");

      const vesselTypes = Object.entries(VESSEL_TYPE_PRESETS).map(([type, preset]) => ({
        type,
        ...preset,
      }));

      res.json({ vesselTypes });
    })
  );

  app.post(
    "/api/admin/telemetry/stress-test",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RUN_TELEMETRY_STRESS_TEST"),
    withErrorHandling("run telemetry stress test", async (req: Request, res: Response) => {
      const stressTestSchema = z.object({
        equipmentId: z.string().min(1),
        orgId: z.string().min(1),
        durationSeconds: z.number().min(1).max(300).default(30),
        messagesPerSecond: z.number().min(10).max(2000).default(100),
        sensorTypes: z.array(z.string()).default(["temperature", "pressure", "vibration"]),
        useBatchWriter: z.boolean().default(true),
      });

      const config = stressTestSchema.parse(req.body);

      logger.info("AdminSimulation", `Starting telemetry stress test: ${config.messagesPerSecond} msg/sec for ${config.durationSeconds}s`);

      const { TelemetryStressTest } = await import("../../../vessel-simulator.js");
      const stressTest = new TelemetryStressTest(storage);
      const result = await stressTest.run(config);

      res.json({
        success: true,
        result,
        message: `Stress test completed: ${result.totalMessages} messages at ${result.actualMsgPerSec} msg/sec`,
      });
    })
  );

  app.post(
    "/api/admin/telemetry/fleet-stress-test",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RUN_FLEET_STRESS_TEST"),
    withErrorHandling("run fleet stress test", async (req: Request, res: Response) => {
      const fleetStressSchema = z.object({
        vesselCount: z.number().min(1).max(50).default(20),
        sensorsPerVessel: z.number().min(1).max(50).default(30),
        durationSeconds: z.number().min(5).max(600).default(30),
        messagesPerSecondPerSensor: z.number().min(0.1).max(10).default(1),
        orgId: z.string().min(1),
        useBatchWriter: z.boolean().default(true),
      });

      const config = fleetStressSchema.parse(req.body);
      const totalSensors = config.vesselCount * config.sensorsPerVessel;
      const targetMsgPerSec = totalSensors * config.messagesPerSecondPerSensor;

      logger.info("AdminSimulation", `Starting fleet stress test: ${config.vesselCount} vessels, ${config.sensorsPerVessel} sensors each (${totalSensors} total), target ${targetMsgPerSec} msg/sec for ${config.durationSeconds}s`);

      const { initFleetStressTest, getFleetStressTest } = await import("../../../vessel-simulator.js");
      let fleetStressTest;
      try {
        fleetStressTest = getFleetStressTest();
      } catch {
        fleetStressTest = initFleetStressTest(storage);
      }
      const result = await fleetStressTest.run(config);

      res.json({
        success: true,
        result,
        summary: {
          totalVessels: result.totalVessels,
          totalSensors: result.totalSensors,
          totalMessages: result.totalMessages,
          actualMsgPerSec: result.actualMsgPerSec,
          targetMsgPerSec: result.targetMsgPerSec,
          efficiency: `${Math.round(result.actualMsgPerSec / result.targetMsgPerSec * 100)}%`,
          errors: result.errors,
          dropped: result.dropped,
          memoryUsageMB: result.memoryUsageMB,
          avgLatencyMs: result.avgLatencyMs,
        },
        message: `Fleet stress test completed: ${result.totalMessages} messages from ${result.totalVessels} vessels at ${result.actualMsgPerSec} msg/sec`,
      });
    })
  );
}

```

---

## `server/domains/config-management/routes.ts` (218 lines)

```ts
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
import type { AuthenticatedRequest } from "../../middleware/auth";

interface ConfigManagementDependencies {
  db: any;
  configAuditLog: any;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
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
      const orgId = req.header("x-org-id") || "default-org-id";

      const result = await configManager.reloadConfig({
        orgId,
        changedBy: (req as AuthenticatedRequest).user?.id,
        changedByName: (req as AuthenticatedRequest).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        autoReload: false,
      });

      if (result.success && result.changed.length > 0) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "config_updated",
          timestamp: new Date().toISOString(),
          changesCount: result.changed.length,
          requiresRestart: result.requiresRestart,
        });
      }

      res.json(result);
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

      res.json({ config: sanitized });
    })
  );

  app.get(
    "/api/admin/config/:key",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIG_VALUE"),
    withErrorHandling("get configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key } = req.params;
      const value = configManager.get(key);
      const isCritical = configManager.isCritical(key);

      if (value === undefined) {
        return res.status(404).json({ error: "Configuration key not found" });
      }

      const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"];
      const isSensitive = sensitiveKeys.some((s) => key.includes(s));

      res.json({
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
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).json({ error: "Value is required" });
      }

      const orgId = req.header("x-org-id") || "default-org-id";

      const result = await configManager.set(key, String(value), {
        orgId,
        changedBy: (req as AuthenticatedRequest).user?.id,
        changedByName: (req as AuthenticatedRequest).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (result.success) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "config_updated",
          timestamp: new Date().toISOString(),
          key,
          requiresRestart: result.requiresRestart,
        });
      }

      res.json(result);
    })
  );

  app.delete(
    "/api/admin/config/:key",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_CONFIG_VALUE"),
    withErrorHandling("delete configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key } = req.params;
      const orgId = req.header("x-org-id") || "default-org-id";

      const result = await configManager.delete(key, {
        orgId,
        changedBy: (req as AuthenticatedRequest).user?.id,
        changedByName: (req as AuthenticatedRequest).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (result.success) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "config_updated",
          timestamp: new Date().toISOString(),
          key,
          deleted: true,
          requiresRestart: result.requiresRestart,
        });
      }

      res.json(result);
    })
  );

  app.get(
    "/api/admin/config/audit",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIG_AUDIT"),
    withErrorHandling("fetch config audit log", async (req: Request, res: Response) => {
      const orgId = req.header("x-org-id") || "default-org-id";
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

      res.json(auditLogs);
    })
  );

  logger.info("ConfigManagementRoutes", "Registered (reload: 1, config: 4, audit: 1)");
}

```

---

## `server/domains/software-updates/routes.ts` (252 lines)

```ts
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

interface SoftwareUpdatesDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
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
      const orgId = req.header("x-org-id") || "default-org-id";
      const { channel } = req.query;

      const manifest = await updateChecker.checkForUpdates(
        orgId,
        (channel as string) || "stable"
      );

      if (manifest) {
        const patch = await updateChecker.registerPatch(orgId, manifest);

        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
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
      const orgId = req.header("x-org-id") || "default-org-id";

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
      const orgId = req.header("x-org-id") || "default-org-id";
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
      const orgId = req.header("x-org-id") || "default-org-id";

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

        const result = await patchApplicator.applyPatch(id, patchPath, (req as AuthenticatedRequest).user?.id);

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

```

---

## `server/domains/data-export/routes.ts` (162 lines)

```ts
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

interface DataExportDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
  upload: any;
}

export function registerDataExportRoutes(
  app: Express,
  deps: DataExportDependencies
): void {
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
      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();
      const orgId = req.header("x-org-id") || req.body.orgId || "default-org-id";
      const exportedBy = (req as AuthenticatedRequest).user?.id || "admin";

      const result = await service.exportOrg(orgId, {
        includeTelemetry: req.body.includeTelemetry ?? false,
        telemetryDays: req.body.telemetryDays ?? 30,
        includeKnowledgeBase: req.body.includeKnowledgeBase ?? true,
        includeAuditLogs: req.body.includeAuditLogs ?? false,
      }, exportedBy);

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
      const { getDataExportImportService } = await import("../../services/data-export-import");
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
      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();
      const exports = await service.listExports();

      res.json(exports.map((e: any) => ({
        id: e.id,
        createdAt: e.createdAt,
        size: e.size,
        downloadUrl: `/api/admin/export/download/${e.id}`,
      })));
    })
  );

  // Delete an export
  app.delete(
    "/api/admin/export/:exportId",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_EXPORT"),
    withErrorHandling("delete export", async (req: Request, res: Response) => {
      const { getDataExportImportService } = await import("../../services/data-export-import");
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

      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();

      const result = await service.importData(req.file.path, {
        targetOrgId: req.body.targetOrgId || req.header("x-org-id"),
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

```

---

## `server/domains/storage-config/routes.ts` (171 lines)

```ts
/**
 * Storage Config Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Object storage configuration, ops database, and file management
 */

import { Express, Request, Response } from "express";
import { withErrorHandling, sendNotFound, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface StorageConfigDependencies {}

export function registerStorageConfigRoutes(
  app: Express,
  deps: StorageConfigDependencies
): void {
  // Get storage configuration
  app.get("/api/storage/config",
    withErrorHandling("list storage configurations", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { kind } = req.query;
      const configs = await storageConfigService.list(kind as string);
      res.json(configs);
    })
  );

  // Create/update storage configuration
  app.post("/api/storage/config",
    withErrorHandling("save storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { insertStorageConfigSchema } = await import("@shared/schema");
      const validatedData = insertStorageConfigSchema.parse(req.body);
      await storageConfigService.upsert(validatedData);
      res.json({ success: true });
    })
  );

  // Delete storage configuration
  app.delete("/api/storage/config/:id",
    withErrorHandling("delete storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      await storageConfigService.delete(req.params.id);
      sendDeleted(res);
    })
  );

  // Test storage configuration
  app.post("/api/storage/config/test",
    withErrorHandling("test storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { insertStorageConfigSchema } = await import("@shared/schema");
      const validatedData = insertStorageConfigSchema.parse(req.body);
      const result = await storageConfigService.test(validatedData);
      res.json(result);
    })
  );

  // Get current ops database
  app.get("/api/storage/ops-db/current",
    withErrorHandling("get current operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const current = await opsDbService.getCurrent();
      res.json(current);
    })
  );

  // Stage ops database URL
  app.post("/api/storage/ops-db/stage",
    withErrorHandling("stage operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      await opsDbService.stage(url);
      res.json({ success: true });
    })
  );

  // Get staged ops database
  app.get("/api/storage/ops-db/staged",
    withErrorHandling("get staged operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const staged = await opsDbService.getStaged();
      res.json(staged);
    })
  );

  // Test ops database connection
  app.post("/api/storage/ops-db/test",
    withErrorHandling("test operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      const result = await opsDbService.test(url);
      res.json(result);
    })
  );

  // Public object access
  app.get("/public-objects/:filePath(*)",
    withErrorHandling("search for public object", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const filePath = req.params.filePath;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return sendNotFound(res, "File");
      }
      objectStorageService.downloadObject(file, res);
    })
  );

  // Upload object
  app.post("/api/objects/upload",
    withErrorHandling("get upload URL", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      if (!(await objectStorageService.isConfigured())) {
        return res.status(503).json({
          error: "Object storage not configured",
          message: "Please configure PUBLIC_OBJECT_SEARCH_PATHS and PRIVATE_OBJECT_DIR environment variables",
        });
      }
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    })
  );

  // Get object (private with ACL)
  app.get("/objects/:objectPath(*)",
    withErrorHandling("access object", async (req: Request, res: Response) => {
      const { ObjectStorageService, ObjectNotFoundError } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return res.sendStatus(404);
        }
        throw error;
      }
    })
  );

  // App storage status
  app.get("/api/storage/app-storage/status",
    withErrorHandling("check app storage status", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const configured = objectStorageService.isConfigured();
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const isReplit = objectStorageService.isReplitEnvironment();

      res.json({
        configured,
        publicObjectSearchPaths: publicPaths,
        privateObjectDir: privateDir,
        replicationEnabled: isReplit,
        environment: isReplit ? "replit" : "external",
      });
    })
  );

  logger.info("StorageConfigRoutes", "Registered (config: 4, ops-db: 4, objects: 4)");
}

```

---

## `server/bootstrap/middleware.ts` (175 lines)

```ts
/**
 * Express Middleware Configuration
 * Security headers, CORS, body parsing, logging
 */

import type { Express } from "express";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import {
  additionalSecurityHeaders,
  sanitizeRequestData,
  detectAttackPatterns,
} from "../security";
import { originAllowed } from "../utils/corsWildcard";
import { safeStringify } from "../utils/redact-log";
import { correlationMiddleware, getCorrelationId } from "../utils/correlation-context";
import { performanceMiddleware } from "../middleware/performance";

export function configureMiddleware(app: Express): void {
  const isDevelopment = process.env.NODE_ENV === "development";

  app.set("trust proxy", true);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: isDevelopment
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
            : ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          // Security (S5332): http: protocol allowed in development only for local testing
          // Production enforces HTTPS-only connections
          connectSrc: isDevelopment
            ? ["'self'", "ws:", "wss:", "https:", "http:"] // NOSONAR: Development convenience
            : ["'self'", "wss:", "https://api.openai.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  const corsOriginFunction = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) { return callback(null, true); }

    // NOSONAR: S5332 - http://localhost allowed for local development only
    // Production deployments use HTTPS exclusively via ALLOWED_ORIGINS env var
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean) || [
      "https://*.replit.dev",
      "https://*.replit.dev:*",
      "https://*.replit.app",
      "https://*.replit.app:*",
      "https://*.replit.co",
      "https://*.replit.co:*",
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      "tauri://localhost",
      "https://tauri.localhost",
    ];

    const allowed = originAllowed(origin, allowedOrigins);

    if (!allowed && isDevelopment) {
      console.warn(`🚨 CORS: Blocked origin ${origin}`);
    }

    callback(null, allowed);
  };

  app.use(correlationMiddleware);

  app.use(
    cors({
      origin: corsOriginFunction,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Device-Id",
        "X-Equipment-Id",
        "X-HMAC-Signature",
        "x-org-id",
        "x-correlation-id",
      ],
      exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "x-correlation-id",
      ],
    })
  );

  app.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: "50mb",
    })
  );

  app.use(additionalSecurityHeaders);
  app.use(detectAttackPatterns);
  app.use(sanitizeRequestData);
  app.use(performanceMiddleware);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson: any, ...args: any[]) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      const loggable = path.startsWith("/api") && !path.startsWith("/api/auth");

      if (loggable) {
        const correlationId = getCorrelationId();
        const shortId = correlationId !== "no-context" ? `[${correlationId.slice(0, 8)}] ` : "";
        let line = `${shortId}${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          line += ` :: ${safeStringify(capturedJsonResponse)}`;
        }
        console.log(line);
      }
    });

    next();
  });
}

export async function configureAuthMiddleware(app: Express): Promise<void> {
  const { requireAuthentication } = await import("../security");
  const { requireOrgId } = await import("../middleware/auth");
  const { withDatabaseContext } = await import("../middleware/db-context");
  const { validateOrgIdHeader } = await import("../orgIdValidation");
  const { apiReadyGate } = await import("../middleware/api-ready-gate");

  app.use("/api", apiReadyGate);
  app.use("/api", requireAuthentication);
  app.use("/api", requireOrgId);
  app.use("/api", validateOrgIdHeader);
  app.use("/api", withDatabaseContext);
}

```

---

## `server/security/authentication.ts` (108 lines)

```ts
/**
 * Authentication Middleware - User authentication
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export async function requireAuthentication(req: Request, res: Response, next: NextFunction) {
  try {
    const healthEndpoints = ["/healthz", "/readyz", "/health", "/metrics"];
    if (healthEndpoints.includes(req.path)) {
      return next();
    }

    if (process.env.NODE_ENV === "development") {
      req.user = {
        id: "dev-admin-user",
        email: "admin@example.com",
        role: "admin",
        name: "Development Admin",
        isActive: true,
      };
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Authorization header required",
        code: "MISSING_AUTH_HEADER",
        message: "Admin endpoints require authentication. Provide Authorization header.",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid authorization format",
        code: "INVALID_AUTH_FORMAT",
        message: "Authorization header must be in format: Bearer <token>",
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        error: "No token provided",
        code: "MISSING_TOKEN",
        message: "Bearer token is required for admin access",
      });
    }

    const validAdminToken = process.env.ADMIN_TOKEN;

    if (!validAdminToken) {
      console.error(
        "ADMIN_TOKEN environment variable is not configured. Admin endpoints disabled for security."
      );
      return res.status(503).json({
        error: "Admin service unavailable",
        code: "ADMIN_SERVICE_DISABLED",
        message: "Admin authentication is not configured. Contact system administrator.",
      });
    }

    if (token !== validAdminToken) {
      return res.status(401).json({
        error: "Invalid token",
        code: "INVALID_TOKEN",
        message: "Provided token is invalid or expired",
      });
    }

    const mockOrgId = "default-org-id";
    let user = await storage.getUserByEmail("admin@example.com", mockOrgId);

    if (!user) {
      user = await storage.createUser({
        orgId: mockOrgId,
        email: "admin@example.com",
        name: "System Administrator",
        role: "admin",
        isActive: true,
        timezone: "UTC",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: "User account is disabled",
        code: "ACCOUNT_DISABLED",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication service unavailable", code: "AUTH_ERROR" });
  }
}

```

---

## `server/security/authorization.ts` (50 lines)

```ts
/**
 * Authorization Middleware - Role validation
 * 
 * SINGLE-TENANT SYSTEM: Org validation removed (uses default-org-id)
 * User roles still enforced for access control
 */

import { Request, Response, NextFunction } from "express";
import { requireAuthentication } from "./authentication";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      code: "INSUFFICIENT_PRIVILEGES",
      requiredRole: "admin",
      userRole: req.user.role,
    });
  }

  next();
}

/**
 * SINGLE-TENANT: Always sets default org ID
 * Cross-org validation removed (single tenant)
 */
export function validateOrganizationAccess(req: Request, _res: Response, next: NextFunction) {
  // SINGLE-TENANT: Set default org ID
  req.orgId = DEFAULT_ORG_ID;
  
  if (req.method === "GET" && req.query) {
    req.query.orgId = DEFAULT_ORG_ID;
  } else if (req.body && typeof req.body === "object") {
    req.body.orgId = DEFAULT_ORG_ID;
  }

  next();
}

export const requireAdminAuth = [
  requireAuthentication,
  requireAdminRole,
  validateOrganizationAccess,
];

```

---

## `server/utils/corsWildcard.ts` (25 lines)

```ts
/**
 * CORS Wildcard Utilities
 * Safe wildcard pattern matching with proper regex escaping
 */

/**
 * Convert wildcard pattern to safe regex
 * Escapes all regex metacharacters except * which becomes [^/]* (non-greedy, bounded)
 *
 * Strategy: Replace * with placeholder, escape everything, then replace placeholder with bounded pattern
 */
export function wildcardToRegex(pat: string): RegExp {
  const trimmed = pat.trim().slice(0, 256);
  const withPlaceholder = trimmed.replace(/\*/g, "__WILDCARD_STAR__");
  const escaped = withPlaceholder.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replaceAll('__WILDCARD_STAR__', "[^/]*");
  return new RegExp(`^${pattern}$`);
}

/**
 * Check if origin is allowed by wildcard patterns
 */
export function originAllowed(origin: string, allowlist: string[]): boolean {
  return allowlist.some((p) => wildcardToRegex(p).test(origin));
}

```

---

