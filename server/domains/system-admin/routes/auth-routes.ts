import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { dbUserStorage } from "../../../db/users/index.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";

const BCRYPT_COST = 12;
const MAX_PASSWORD_LENGTH = 128;

function isLocalhostOrTauri(req: Request): boolean {
  const ip = req.ip || "";
  const isLocalIp =
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost";
  const origin = req.headers.origin || "";
  const isTauriOrigin =
    origin === "tauri://localhost" || origin === "https://tauri.localhost";
  return isLocalIp || isTauriOrigin;
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function atomicWriteEnv(envPath: string, content: string): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const tmpPath = path.join(path.dirname(envPath), `.env.tmp.${Date.now()}`);
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, envPath);
}

async function readEnvContent(envPath: string): Promise<string> {
  const fs = await import("fs/promises");
  try {
    return await fs.readFile(envPath, "utf-8");
  } catch {
    return "";
  }
}

function quoteEnvValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function registerAuthRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
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

      const storedHash = process.env.ADMIN_TOKEN_HASH;
      const legacyPlaintext = process.env.ADMIN_TOKEN;

      if (!storedHash && !legacyPlaintext) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      let isValid = false;

      if (storedHash) {
        isValid = await bcrypt.compare(password, storedHash);
      } else if (legacyPlaintext) {
        isValid = password === legacyPlaintext;
        if (isValid) {
          const path = await import("path");
          const envPath = path.join(process.cwd(), ".env");
          try {
            const hash = await bcrypt.hash(password, BCRYPT_COST);
            let envContent = await readEnvContent(envPath);
            envContent = envContent.replace(/^ADMIN_TOKEN=.*/m, "");
            envContent = envContent.replace(/\n{2,}/g, "\n").trim();
            const finalContent = envContent
              ? `${envContent}\nADMIN_TOKEN_HASH=${quoteEnvValue(hash)}\n`
              : `ADMIN_TOKEN_HASH=${quoteEnvValue(hash)}\n`;
            await atomicWriteEnv(envPath, finalContent);
            process.env.ADMIN_TOKEN_HASH = hash;
            delete process.env.ADMIN_TOKEN;
            logger.info("AdminAuth", "Migrated legacy ADMIN_TOKEN to ADMIN_TOKEN_HASH");
          } catch (migrationError) {
            logger.warn("AdminAuth", "Failed to migrate legacy ADMIN_TOKEN to hash", migrationError);
          }
        }
      }

      if (!isValid) {
        logger.warn("AdminAuth", `Failed admin password verification from ${req.ip}`);
        res.status(401).json({
          error: "Invalid password",
          code: "INVALID_PASSWORD",
        });
        return;
      }

      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionTokenHash = hashSessionToken(sessionToken);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const mockOrgId = "default-org-id";
      let adminUser = await dbUserStorage.getUserByEmail("admin@example.com", mockOrgId);

      if (!adminUser) {
        adminUser = await dbUserStorage.createUser({
          orgId: mockOrgId,
          email: "admin@example.com",
          name: "System Administrator",
          role: "admin",
          isActive: true,
        });
      }

      await dbSystemAdminStorage.createAdminSession({
        orgId: mockOrgId,
        sessionToken: sessionTokenHash,
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
    withErrorHandling("check admin auth status", async (req: Request, res: Response) => {
      if (!isLocalhostOrTauri(req)) {
        res.json({ configured: true });
        return;
      }
      const configured = !!(process.env.ADMIN_TOKEN_HASH || process.env.ADMIN_TOKEN);
      res.json({ configured });
    })
  );

  app.post(
    "/api/admin/auth/setup",
    criticalOperationRateLimit,
    withErrorHandling("initial admin password setup", async (req: Request, res: Response) => {
      if (!isLocalhostOrTauri(req)) {
        res.status(403).json({
          error: "Setup is only available from localhost or Tauri",
          code: "SETUP_LOCALHOST_ONLY",
        });
        return;
      }

      if (process.env.ADMIN_TOKEN_HASH || process.env.ADMIN_TOKEN) {
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

      if (password.length > MAX_PASSWORD_LENGTH) {
        res.status(400).json({
          error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
          code: "PASSWORD_TOO_LONG",
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

      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        const hash = await bcrypt.hash(password, BCRYPT_COST);
        const envContent = await readEnvContent(envPath);

        const finalContent = envContent
          ? `${envContent.trimEnd()}\nADMIN_TOKEN_HASH=${quoteEnvValue(hash)}\n`
          : `ADMIN_TOKEN_HASH=${quoteEnvValue(hash)}\n`;

        await atomicWriteEnv(envPath, finalContent);
        process.env.ADMIN_TOKEN_HASH = hash;

        const sessionToken = crypto.randomBytes(32).toString("hex");
        const sessionTokenHash = hashSessionToken(sessionToken);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        const mockOrgId = "default-org-id";
        let adminUser = await dbUserStorage.getUserByEmail("admin@example.com", mockOrgId);

        if (!adminUser) {
          adminUser = await dbUserStorage.createUser({
            orgId: mockOrgId,
            email: "admin@example.com",
            name: "System Administrator",
            role: "admin",
            isActive: true,
          });
        }

        await dbSystemAdminStorage.createAdminSession({
          orgId: mockOrgId,
          sessionToken: sessionTokenHash,
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

      const storedHash = process.env.ADMIN_TOKEN_HASH;
      const legacyPlaintext = process.env.ADMIN_TOKEN;

      if (!storedHash && !legacyPlaintext) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (newPassword.length > MAX_PASSWORD_LENGTH) {
        res.status(400).json({
          error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
          code: "PASSWORD_TOO_LONG",
        });
        return;
      }

      let isValid = false;
      if (storedHash) {
        isValid = await bcrypt.compare(currentPassword, storedHash);
      } else if (legacyPlaintext) {
        isValid = currentPassword === legacyPlaintext;
      }

      if (!isValid) {
        logger.warn("AdminAuth", `Failed admin password change attempt from ${req.ip}`);
        res.status(401).json({
          error: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
        return;
      }

      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
        let envContent = await readEnvContent(envPath);

        envContent = envContent.replace(/^ADMIN_TOKEN_HASH=.*/m, "");
        envContent = envContent.replace(/^ADMIN_TOKEN=.*/m, "");
        envContent = envContent.replace(/\n{2,}/g, "\n").trim();

        const finalContent = envContent
          ? `${envContent}\nADMIN_TOKEN_HASH=${quoteEnvValue(newHash)}\n`
          : `ADMIN_TOKEN_HASH=${quoteEnvValue(newHash)}\n`;

        await atomicWriteEnv(envPath, finalContent);
        process.env.ADMIN_TOKEN_HASH = newHash;
        delete process.env.ADMIN_TOKEN;

        await dbSystemAdminStorage.invalidateAllAdminSessions();

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
            "Failed to persist password change. Please update ADMIN_TOKEN_HASH in your environment secrets manually.",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );
}
