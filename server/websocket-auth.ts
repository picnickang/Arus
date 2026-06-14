import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";
import { createLogger } from "./lib/structured-logger";
import { dbSystemAdminStorage, dbUserStorage } from "./repositories";
import { resolveDevLoginSessionToken } from "./security/dev-login";

const logger = createLogger("Websocket");

interface UpgradeAuthResult {
  ok: true;
  orgId: string;
  userId?: string;
}

interface UpgradeAuthRejection {
  ok: false;
  reason: string;
}

type UpgradeAuth = UpgradeAuthResult | UpgradeAuthRejection;

export function parseOrgConnectionLimit(): number {
  const raw = process.env["WS_ORG_CONNECTION_LIMIT"];
  if (!raw) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function resolveUpgradeOrg(req: IncomingMessage): Promise<UpgradeAuth> {
  const tenantAuth = requireTenantAuth();

  let token: string | undefined;
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim() || undefined;
  }
  if (!token && req.url) {
    try {
      const u = new URL(req.url, "http://x");
      const t = u.searchParams.get("token");
      if (t) {
        token = t;
      }
    } catch {
      /* malformed url */
    }
  }

  if (!token) {
    if (tenantAuth) {
      return { ok: false, reason: "UNAUTHENTICATED" };
    }
    return { ok: true, orgId: DEFAULT_ORG_ID };
  }

  try {
    const devSession = resolveDevLoginSessionToken(token);
    if (devSession) {
      return { ok: true, orgId: devSession.orgId, userId: devSession.id };
    }

    const session = await dbSystemAdminStorage.getAdminSessionByToken(hashSessionToken(token));
    if (!session) {
      return { ok: false, reason: "INVALID_TOKEN" };
    }
    if (new Date(session.expiresAt) < new Date()) {
      return { ok: false, reason: "SESSION_EXPIRED" };
    }
    const user = session.userId ? await dbUserStorage.getUser(session.userId) : null;
    if (!user || !user.isActive) {
      return { ok: false, reason: tenantAuth ? "SESSION_USER_MISSING" : "USER_INACTIVE" };
    }
    if (tenantAuth && (!user.orgId || user.orgId.trim() === "")) {
      return { ok: false, reason: "TENANT_CLAIM_MISSING" };
    }
    return { ok: true, orgId: user.orgId || DEFAULT_ORG_ID, userId: user.id };
  } catch (err) {
    logger.error("ws upgrade auth lookup failed", undefined, err as Error);
    return { ok: false, reason: "AUTH_LOOKUP_FAILED" };
  }
}
