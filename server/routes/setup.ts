import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import { createLogger } from "../lib/structured-logger";
import { verifySetupToken } from "./setup-token";
import {
  getSetupSetting,
  upsertSetupSetting,
} from "../domains/system-admin/application/setup-bootstrap-service.js";

const logger = createLogger("Routes:Setup");
const router = Router();

router.use(express.json());

function isLoopbackAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

/** P2 #2 — see `./setup-token.ts` for the pure constant-time verifier. */
function hasValidSetupToken(req: Request): boolean {
  return verifySetupToken(process.env['SETUP_TOKEN'], req.headers["x-setup-token"]);
}

/**
 * P2 #2 — Best-effort audit trail for every remote setup-route hit
 * (success and failure). Loopback/Tauri paths are not logged here
 * because they are functionally the operator's own machine; failures
 * from the wider network or with a presented X-Setup-Token always
 * are. Audit is fire-and-forget structured-log only (avoids creating
 * a DB dependency on a route that runs pre-setup).
 */
function auditSetupAttempt(
  req: Request,
  outcome: "allowed" | "denied",
  reason: string
): void {
  logger.warn("Setup route access attempt", {
    outcome,
    reason,
    path: req.path,
    method: req.method,
    remoteAddress: req.socket.remoteAddress ?? "unknown",
    forwardedFor: req.headers["x-forwarded-for"] ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    origin: req.headers.origin ?? null,
    tokenPresented: typeof req.headers["x-setup-token"] === "string",
  });
}

function localOnlyGuard(req: Request, res: Response, next: NextFunction) {
  const socketAddress = req.socket.remoteAddress || "";
  const isLocal = isLoopbackAddress(socketAddress);
  const origin = req.headers.origin || "";
  const isTauriOrigin = origin === "tauri://localhost" || origin === "https://tauri.localhost";
  const isTauriUserAgent = req.headers["user-agent"]?.includes("Tauri") || false;
  const isReplitDevelopment = !!process.env['REPL_ID'] && process.env['NODE_ENV'] !== "production";

  if (isLocal || isTauriOrigin || isTauriUserAgent || isReplitDevelopment) {
    next();
    return undefined;
  }

  // Remote caller: audit every attempt and require a valid token.
  const tokenOk = hasValidSetupToken(req);
  auditSetupAttempt(req, tokenOk ? "allowed" : "denied", tokenOk ? "valid-setup-token" : "no-or-invalid-setup-token");
  if (!tokenOk) {
    return res.status(403).json({
      error: "Setup is only available from localhost/Tauri, development Replit, or with X-Setup-Token",
      code: "SETUP_LOCAL_ONLY",
    });
  }
  next();
  return undefined;
}

const getSetting = getSetupSetting;
const upsertSetting = upsertSetupSetting;

router.post("/complete", localOnlyGuard, async (req: Request, res: Response) => {
  const { mode, vesselId, adminPassword } = req.body as {
    mode: "vessel" | "cloud";
    vesselId?: string;
    adminPassword: string;
  };

  if (!adminPassword || typeof adminPassword !== "string") {
    return res.status(400).json({ error: "adminPassword is required" });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: "adminPassword must be at least 8 characters" });
  }
  if (!mode || !["vessel", "cloud"].includes(mode)) {
    return res.status(400).json({ error: "mode must be vessel or cloud" });
  }

  try {
    const alreadyDone = await isSetupComplete();
    if (alreadyDone) {
      return res.status(409).json({
        error: "Setup has already been completed. Use the admin panel to change settings.",
      });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await saveAdminCredentials(passwordHash);

    if (vesselId?.trim()) {
      await saveVesselId(vesselId.trim());
    }

    await saveSetting("deployment", "mode", mode);
    await saveSetting("setup", "completed", "true");
    await saveSetting("setup", "completed_at", new Date().toISOString());

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    logger.error("[ARUS] /api/setup/complete error:", undefined, err);
    return res.status(500).json({ error: "Setup failed. Check server logs." });
  }
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const complete = await isSetupComplete();
    return res.status(200).json({ complete });
  } catch {
    return res.status(200).json({ complete: false });
  }
});

async function isSetupComplete(): Promise<boolean> {
  return (await getSetting("setup", "completed")) === "true";
}

async function saveAdminCredentials(passwordHash: string): Promise<void> {
  await upsertSetting("auth", "admin_password_hash", passwordHash, {
    isSecret: true,
    description: "Bcrypt hash of the local admin password",
  });
}

async function saveVesselId(vesselId: string): Promise<void> {
  await upsertSetting("vessel", "vessel_id", vesselId, {
    description: "Vessel identifier set during initial setup",
  });
}

async function saveSetting(category: string, key: string, value: string): Promise<void> {
  await upsertSetting(category, key, value);
}

export default router;
