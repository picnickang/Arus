import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import bcrypt from "bcryptjs";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { constantTimeEqualString } from "../../../lib/constant-time-compare.js";

const BCRYPT_COST = 12;
const MAX_PASSWORD_LENGTH = 128;

// LR-3.5 / SEC-2: constant-time compare lives in
// `server/lib/constant-time-compare.ts` so unit tests can import it
// without dragging the DB-bearing auth-routes module in.
export { constantTimeEqualString };

function isLoopbackAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function hasValidSetupToken(req: Request): boolean {
  const configuredToken = process.env["SETUP_TOKEN"];
  if (!configuredToken) {
    return false;
  }
  const provided = req.headers["x-setup-token"];
  if (typeof provided !== "string" || provided.length === 0) {
    return false;
  }
  // LR-3.5 / SEC-2: use a constant-time compare (helper above hashes
  // both sides to a fixed-size digest first so length differences do
  // not themselves leak). The helper already exists in this file; the
  // prior `===` would short-circuit on the first differing byte and
  // give a network-timing attacker a viable channel against
  // SETUP_TOKEN despite the per-IP rate limit.
  return constantTimeEqualString(provided, configuredToken);
}

// Exported for unit testing (see auth-routes-localhost-guard.test.ts) so the
// header-spoofing regression can be asserted without standing up the full
// DB-bearing route module.
export function isLocalSetupRequest(req: Request): boolean {
  // SEC: trust ONLY the transport-level peer address and server-side
  // env — never client-supplied headers. The previous gate also
  // accepted `Origin: tauri://localhost` and a `User-Agent` containing
  // "Tauri", both of which a remote attacker fully controls, letting an
  // unauthenticated caller pass the localhost-only guard and seize the
  // first-run admin bootstrap. The legitimate Tauri desktop sidecar
  // talks to the bundled Node server over loopback, so it is already
  // covered by `isLoopbackAddress` without any header check. `REPL_ID`
  // is a server-side env var (not spoofable) and only relaxes the gate
  // in non-production Replit previews.
  const socketAddress = req.socket.remoteAddress || "";
  const isReplitDevelopment = !!process.env["REPL_ID"] && process.env["NODE_ENV"] !== "production";
  return isLoopbackAddress(socketAddress) || isReplitDevelopment || hasValidSetupToken(req);
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

// Warn at most once per process when the legacy plaintext fallback is used,
// so a dev environment is loudly reminded to migrate without spamming a line
// on every single auth attempt.
let warnedLegacyAdminToken = false;

// Exported for unit testing of the production plaintext-token gate. Not part
// of the route surface — callers within this module use it directly.
export async function getAdminCredential(): Promise<{ hash?: string; legacyPlaintext?: string }> {
  const databaseHash = await readDatabaseAdminHash();
  if (databaseHash) {
    return { hash: databaseHash };
  }

  if (process.env["ADMIN_TOKEN_HASH"]) {
    return { hash: process.env["ADMIN_TOKEN_HASH"] };
  }

  if (process.env["ADMIN_TOKEN"]) {
    // Legacy plaintext admin token. A plaintext credential sitting in the
    // process environment is trivially exfiltrated (crash dumps, /proc, child
    // process env) and must NEVER be the basis of admin auth in production.
    // Production requires a bcrypt hash (database `admin_password_hash` or
    // ADMIN_TOKEN_HASH); the plaintext fallback is honoured in non-production
    // only, as a developer convenience.
    if (process.env["NODE_ENV"] === "production") {
      logger.error(
        "AdminAuth",
        "Ignoring plaintext ADMIN_TOKEN in production — provision ADMIN_TOKEN_HASH (bcrypt) or a database admin hash. Admin auth stays disabled until a hash exists."
      );
      return {};
    }
    if (!warnedLegacyAdminToken) {
      warnedLegacyAdminToken = true;
      logger.warn(
        "AdminAuth",
        "Honouring legacy plaintext ADMIN_TOKEN (non-production only). Migrate to ADMIN_TOKEN_HASH (bcrypt); this fallback is rejected under NODE_ENV=production."
      );
    }
    return { legacyPlaintext: process.env["ADMIN_TOKEN"] };
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
  process.env["ADMIN_TOKEN_HASH"] = hash;
  delete process.env["ADMIN_TOKEN"];
}

async function persistAdminHash(hash: string): Promise<void> {
  await upsertDatabaseAdminHash(hash);
  try {
    await mirrorAdminHashToEnv(hash);
  } catch (error) {
    logger.warn("AdminAuth", "Admin hash saved to database, but .env mirror failed", error);
    process.env["ADMIN_TOKEN_HASH"] = hash;
    delete process.env["ADMIN_TOKEN"];
  }
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

  app.get(
    "/api/admin/auth/status",
    generalApiRateLimit,
    withErrorHandling("check admin auth status", async (req: Request, res: Response) => {
      if (!isLocalSetupRequest(req)) {
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
      if (!isLocalSetupRequest(req)) {
        res.status(403).json({
          error: "Setup is only available from localhost or with a valid X-Setup-Token",
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

        logger.info("AdminAuth", `Initial admin password configured from ${req.ip}`);

        // No session is minted here. The shared-password admin unlock has
        // been retired; admins authenticate with a real account via
        // `/api/portal/login`. This route only bootstraps the credential.
        res.json({ success: true });
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
        isValid = constantTimeEqualString(currentPassword, credential.legacyPlaintext);
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
