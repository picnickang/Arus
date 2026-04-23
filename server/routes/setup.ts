import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Routes:Setup");

const router = Router();

router.use(express.json());

function localOnlyGuard(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "";
  const isLocal = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"].some((addr) =>
    ip.includes(addr)
  );
  const isTauri = req.headers["user-agent"]?.includes("Tauri") || false;
  const isReplit = !!process.env.REPL_ID;

  if (!isLocal && !isTauri && !isReplit) {
    return res.status(403).json({ error: "Setup is only available from localhost" });
  }
  next();
}

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
  if (!["vessel", "cloud"].includes(mode)) {
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

    if (mode) {
      await saveSetting("deployment", "mode", mode);
    }

    await saveSetting("setup", "completed", "true");
    await saveSetting("setup", "completed_at", new Date().toISOString());

    return res.status(200).json({ ok: true });
  } catch (err: any) {
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

async function getDbClient() {
  const { createClient } = await import("@libsql/client");

  const isVessel = process.env.DEPLOYMENT_MODE === "VESSEL" || process.env.LOCAL_MODE === "true";

  if (isVessel) {
    const dbPath = process.env.DATABASE_PATH ?? "data/vessel-local.db";
    return createClient({ url: `file:${dbPath}` });
  }

  const url = process.env.TURSO_DB_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL or TURSO_DB_URL is required in cloud mode");
  }
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({ url, authToken });
}

async function isSetupComplete(): Promise<boolean> {
  const client = await getDbClient();
  try {
    const result = await client.execute({
      sql: `SELECT value FROM admin_system_settings
            WHERE org_id = 'default-org-id'
              AND category = 'setup'
              AND key = 'completed'
            LIMIT 1`,
      args: [],
    });
    return result.rows.length > 0 && result.rows[0].value === "true";
  } catch {
    return false;
  } finally {
    client.close();
  }
}

async function saveAdminCredentials(passwordHash: string): Promise<void> {
  const client = await getDbClient();
  try {
    await client.execute({
      sql: `INSERT INTO admin_system_settings
              (org_id, category, key, value, data_type, is_sensitive, description)
            VALUES
              ('default-org-id', 'auth', 'admin_password_hash', ?, 'string', 1,
               'Bcrypt hash of the local admin password')
            ON CONFLICT(org_id, category, key)
            DO UPDATE SET value = excluded.value,
                          updated_at = strftime('%s','now')`,
      args: [passwordHash],
    });
  } finally {
    client.close();
  }
}

async function saveVesselId(vesselId: string): Promise<void> {
  const client = await getDbClient();
  try {
    await client.execute({
      sql: `UPDATE update_settings
            SET vessel_id  = ?,
                updated_at = strftime('%s','now')
            WHERE org_id = 'default-org-id'`,
      args: [vesselId],
    });
    await client.execute({
      sql: `INSERT INTO admin_system_settings
              (org_id, category, key, value, data_type, description)
            VALUES
              ('default-org-id', 'vessel', 'vessel_id', ?, 'string',
               'Vessel identifier set during initial setup')
            ON CONFLICT(org_id, category, key)
            DO UPDATE SET value = excluded.value,
                          updated_at = strftime('%s','now')`,
      args: [vesselId],
    });
  } finally {
    client.close();
  }
}

async function saveSetting(category: string, key: string, value: string): Promise<void> {
  const client = await getDbClient();
  try {
    await client.execute({
      sql: `INSERT INTO admin_system_settings
              (org_id, category, key, value, data_type)
            VALUES
              ('default-org-id', ?, ?, ?, 'string')
            ON CONFLICT(org_id, category, key)
            DO UPDATE SET value = excluded.value,
                          updated_at = strftime('%s','now')`,
      args: [category, key, value],
    });
  } finally {
    client.close();
  }
}

export default router;
