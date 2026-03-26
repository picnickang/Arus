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
