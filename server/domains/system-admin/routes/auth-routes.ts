import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { dbUserStorage } from "../../../db/users/index.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { loginRateLimit } from "../../../middleware/rate-limiters.js";

const BCRYPT_COST = 12;
const MAX_PASSWORD_LENGTH = 128;

function isLoopbackAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function hasValidSetupToken(req: Request): boolean {
  const configuredToken = process.env['SETUP_TOKEN'];
  if (!configuredToken) {
    return false;
  }
  const provided = req.headers["x-setup-token"];
  return typeof provided === "string" && provided.length > 0 && provided === configuredToken;
}

function isLocalhostOrTauri(req: Request): boolean {
  const socketAddress = req.socket.remoteAddress || "";
  const origin = req.headers.origin || "";
  const isTauriOrigin = origin === "tauri://localhost" || origin === "https://tauri.localhost";
  const isTauriUserAgent = req.headers["user-agent"]?.includes("Tauri") || false;
  const isReplitDevelopment = !!process.env['REPL_ID'] && process.env['NODE_ENV'] !== "production";
  return (
    isLoopbackAddress(socketAddress) ||
    isTauriOrigin ||
    isTauriUserAgent ||
    isReplitDevelopment ||
    hasValidSetupToken(req)
  );
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

function normalizeAdminSettingValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return undefined;
  }
  if (typeof value === "object" && "hash" in value) {
    const hash = (value as { hash?: unknown }).hash;
    return typeof hash === "string" ? hash : undefined;
  }
  return String(value);
}

async function readDatabaseAdminHash(): Promise<string | undefined> {
  try {
    const setting = await dbSystemAdminStorage.getAdminSystemSetting(
      DEFAULT_ORG_ID,
      "auth",
      "admin_password_hash"
    );
    return normalizeAdminSettingValue(setting?.value);
  } catch (error) {
    logger.warn("AdminAuth", "Could not read database admin password hash", error);
    return undefined;
  }
}

async function upsertDatabaseAdminHash(hash: string): Promise<void> {
  const existing = await dbSystemAdminStorage.getAdminSystemSetting(
    DEFAULT_ORG_ID,
    "auth",
    "admin_password_hash"
  );
  const payload = {
    orgId: DEFAULT_ORG_ID,
    category: "auth",
    key: "admin_password_hash",
    value: hash,
    dataType: "string" as const,
    isSecret: true,
    description: "Bcrypt hash of the admin password",
  };

  if (existing?.id) {
    await dbSystemAdminStorage.updateAdminSystemSetting(existing.id, payload);
    return;
  }

  await dbSystemAdminStorage.createAdminSystemSetting(payload);
}

async function getAdminCredential(): Promise<{ hash?: string; legacyPlaintext?: string }> {
  const databaseHash = await readDatabaseAdminHash();
  if (databaseHash) {
    return { hash: databaseHash };
  }

  if (process.env['ADMIN_TOKEN_HASH']) {
    return { hash: process.env['ADMIN_TOKEN_HASH'] };
  }

  if (process.env['ADMIN_TOKEN']) {
    return { legacyPlaintext: process.env['ADMIN_TOKEN'] };
  }

  return {};
}

async function mirrorAdminHashToEnv(hash: string): Promise<void> {
  const path = await import("path");
  const envPath = path.join(process.cwd(), ".env");
  let envContent = await readEnvContent(envPath);

  envContent = envContent.replace(/^ADMIN_TOKEN_HASH=.*/m, "");
  envContent = envContent.replace(/^ADMIN_TOKEN=.*/m, "");
  envContent = envContent.replace(/\n{2,}/g, "\n").trim();

  const finalContent = envContent
    ? `${envContent}\nADMIN_TOKEN_HASH=${quoteEnvValue(hash)}\n`
    : `ADMIN_TOKEN_HASH=${quoteEnvValue(hash)}\n`;

  await atomicWriteEnv(envPath, finalContent);
  process.env['ADMIN_TOKEN_HASH'] = hash;
  delete process.env['ADMIN_TOKEN'];
}

async function persistAdminHash(hash: string): Promise<void> {
  await upsertDatabaseAdminHash(hash);
  try {
    await mirrorAdminHashToEnv(hash);
  } catch (error) {
    logger.warn("AdminAuth", "Admin hash saved to database, but .env mirror failed", error);
    process.env['ADMIN_TOKEN_HASH'] = hash;
    delete process.env['ADMIN_TOKEN'];
  }
}

async function createAdminSession(req: Request): Promise<{
  sessionToken: string;
  expiresAt: Date;
  expiresIn: number;
}> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = hashSessionToken(sessionToken);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2);

  let adminUser = await dbUserStorage.getUserByEmail("admin@example.com", DEFAULT_ORG_ID);

  if (!adminUser) {
    adminUser = await dbUserStorage.createUser({
      orgId: DEFAULT_ORG_ID,
      email: "admin@example.com",
      name: "System Administrator",
      role: "admin",
      isActive: true,
      timezone: "UTC",
    });
  }

  await dbSystemAdminStorage.createAdminSession({
    orgId: DEFAULT_ORG_ID,
    sessionToken: sessionTokenHash,
    userId: adminUser.id,
    adminEmail: "admin@example.com",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    expiresAt,
    lastActivityAt: new Date(),
  });

  return {
    sessionToken,
    expiresAt,
    expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  };
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
    // Prod-hardening: credential-stuffing limiter (5 attempts / 15 min
    // per IP) layered BEFORE the generic API limiter so brute-force
    // attempts can't dilute against the per-org+UA bucket.
    loginRateLimit,
    generalApiRateLimit,
    withErrorHandling("verify admin authentication", async (req: Request, res: Response) => {
      const { password } = adminPasswordVerifySchema.parse(req.body);

      const credential = await getAdminCredential();

      if (!credential.hash && !credential.legacyPlaintext) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      let isValid = false;

      if (credential.hash) {
        isValid = await bcrypt.compare(password, credential.hash);
      } else if (credential.legacyPlaintext) {
        isValid = password === credential.legacyPlaintext;
        if (isValid) {
          try {
            const hash = await bcrypt.hash(password, BCRYPT_COST);
            await persistAdminHash(hash);
            logger.info("AdminAuth", "Migrated legacy ADMIN_TOKEN to database-backed ADMIN_TOKEN_HASH");
          } catch (migrationError) {
            logger.warn(
              "AdminAuth",
              "Failed to migrate legacy ADMIN_TOKEN to hash",
              migrationError
            );
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

      const { sessionToken, expiresAt, expiresIn } = await createAdminSession(req);

      logger.info("AdminAuth", `Admin session created from ${req.ip}`);

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
      const credential = await getAdminCredential();
      const configured = !!(credential.hash || credential.legacyPlaintext);
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

      const existingCredential = await getAdminCredential();
      if (existingCredential.hash || existingCredential.legacyPlaintext) {
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

      try {
        const hash = await bcrypt.hash(password, BCRYPT_COST);
        await persistAdminHash(hash);

        const { sessionToken, expiresAt, expiresIn } = await createAdminSession(req);

        logger.info("AdminAuth", `Initial admin password configured from ${req.ip}`);

        res.json({
          success: true,
          sessionToken,
          expiresAt: expiresAt.toISOString(),
          expiresIn,
        });
      } catch (error) {
        logger.error("AdminAuth", "Failed to persist admin password during setup", error);
        res.status(500).json({
          error: "Failed to persist admin password",
          code: "ADMIN_PASSWORD_PERSIST_FAILED",
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

      const credential = await getAdminCredential();

      if (!credential.hash && !credential.legacyPlaintext) {
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
      if (credential.hash) {
        isValid = await bcrypt.compare(currentPassword, credential.hash);
      } else if (credential.legacyPlaintext) {
        isValid = currentPassword === credential.legacyPlaintext;
      }

      if (!isValid) {
        logger.warn("AdminAuth", `Failed admin password change attempt from ${req.ip}`);
        res.status(401).json({
          error: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
        return;
      }

      try {
        const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
        await persistAdminHash(newHash);

        await dbSystemAdminStorage.invalidateAllAdminSessions();

        logger.info("AdminAuth", `Admin password changed successfully from ${req.ip}`);

        res.json({
          success: true,
          message:
            "Password changed successfully. All admin sessions have been invalidated. Please log in again with your new password.",
        });
      } catch (error) {
        logger.error("AdminAuth", "Failed to persist password change", error);
        res.status(500).json({
          error: "Failed to persist password change.",
          code: "ADMIN_PASSWORD_PERSIST_FAILED",
        });
      }
    })
  );
}
