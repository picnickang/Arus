import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Security:Authentication");
import { Request, Response, NextFunction } from "express";
import { dbSystemAdminStorage, dbUserStorage } from "../repositories";
import crypto from "crypto";
import { isPublicApiPath } from "../bootstrap/public-api-paths";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";
import { resolveDevLoginSessionToken } from "./dev-login";

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type AdminSession = NonNullable<
  Awaited<ReturnType<typeof dbSystemAdminStorage.getAdminSessionByToken>>
>;
type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof dbUserStorage.getUser>>>;

/**
 * Hot-path cache: every authenticated request was doing a session SELECT, a
 * user SELECT, and an awaited activity UPDATE. Entries live 30s (bounded
 * revocation/disable staleness — the expiry check still runs every request),
 * and activity writes are throttled to one per session per minute,
 * fire-and-forget.
 */
const SESSION_CACHE_TTL_MS = 30_000;
const ACTIVITY_WRITE_INTERVAL_MS = 60_000;
const SESSION_CACHE_MAX_ENTRIES = 1000;

interface CachedAuth {
  session: AdminSession;
  user: AuthenticatedUser;
  cachedAt: number;
}

const sessionCache = new Map<string, CachedAuth>();
const lastActivityWrite = new Map<string, number>();

/** Call when a session is revoked/logged out so the cache can't outlive it. */
export function invalidateSessionCache(tokenHash?: string): void {
  if (tokenHash) {
    sessionCache.delete(tokenHash);
  } else {
    sessionCache.clear();
  }
}

function readSessionCache(tokenHash: string): CachedAuth | null {
  const entry = sessionCache.get(tokenHash);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.cachedAt >= SESSION_CACHE_TTL_MS) {
    sessionCache.delete(tokenHash);
    return null;
  }
  return entry;
}

function writeSessionCache(tokenHash: string, entry: CachedAuth): void {
  if (sessionCache.size >= SESSION_CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, value] of sessionCache) {
      if (now - value.cachedAt >= SESSION_CACHE_TTL_MS) {
        sessionCache.delete(key);
      }
    }
    if (sessionCache.size >= SESSION_CACHE_MAX_ENTRIES) {
      sessionCache.clear();
    }
  }
  sessionCache.set(tokenHash, entry);
}

function touchSessionActivity(sessionId: string): void {
  const now = Date.now();
  const last = lastActivityWrite.get(sessionId) ?? 0;
  if (now - last < ACTIVITY_WRITE_INTERVAL_MS) {
    return;
  }
  lastActivityWrite.set(sessionId, now);
  if (lastActivityWrite.size > SESSION_CACHE_MAX_ENTRIES * 2) {
    lastActivityWrite.clear();
  }
  void dbSystemAdminStorage.updateAdminSessionActivity(sessionId).catch((error: unknown) => {
    logger.warn("Failed to record session activity:", undefined, error);
  });
}

export const _sessionCacheInternals = {
  sessionCache,
  lastActivityWrite,
  clear(): void {
    sessionCache.clear();
    lastActivityWrite.clear();
  },
};

export async function requireAuthentication(req: Request, res: Response, next: NextFunction) {
  try {
    if (isPublicApiPath(req)) {
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

    const devSession = resolveDevLoginSessionToken(token);
    if (devSession) {
      req.user = {
        id: devSession.id,
        email: devSession.email,
        role: devSession.role,
        name: devSession.name,
        isActive: true,
        orgId: devSession.orgId,
      };
      return next();
    }

    const tokenHash = hashSessionToken(token);
    const cached = readSessionCache(tokenHash);
    const session = cached?.session ?? (await dbSystemAdminStorage.getAdminSessionByToken(tokenHash));

    if (session) {
      if (new Date(session.expiresAt) < new Date()) {
        invalidateSessionCache(tokenHash);
        return res.status(401).json({
          error: "Session expired",
          code: "SESSION_EXPIRED",
          message: "Your session has expired. Please log in again.",
        });
      }

      touchSessionActivity(session.id);

      // Push B1: source orgId from the persisted user record. In legacy
      // mode (REQUIRE_TENANT_AUTH unset) we still auto-provision the
      // admin user under DEFAULT_ORG_ID so existing single-tenant boots
      // keep working. In tenant-auth mode the session MUST already have
      // a `userId` pointing at a real user — there's no safe "default
      // tenant" to land in.
      const tenantAuth = requireTenantAuth();
      let user: AuthenticatedUser | null | undefined = cached?.user;
      if (!user) {
        user = session.userId
          ? await dbUserStorage.getUser(session.userId)
          : tenantAuth
            ? null
            : await dbUserStorage.getUserByEmail(
                session.adminEmail || "admin@example.com",
                DEFAULT_ORG_ID
              );
      }

      if (!user) {
        if (tenantAuth) {
          return res.status(401).json({
            error: "Session has no associated user",
            code: "SESSION_USER_MISSING",
          });
        }
        user = await dbUserStorage.createUser({
          orgId: DEFAULT_ORG_ID,
          email: session.adminEmail || "admin@example.com",
          name: "System Administrator",
          role: "admin",
          isActive: true,
          timezone: "UTC",
        });
      }

      if (!user.isActive) {
        invalidateSessionCache(tokenHash);
        return res.status(401).json({
          error: "User account is disabled",
          code: "ACCOUNT_DISABLED",
        });
      }

      if (!cached) {
        writeSessionCache(tokenHash, { session, user, cachedAt: Date.now() });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        orgId: user.orgId,
      };

      return next();
    }

    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
      message: "Provided token is invalid or expired. Please log in again.",
    });
  } catch (error) {
    logger.error("Authentication error:", undefined, error);
    res.status(500).json({ error: "Authentication service unavailable", code: "AUTH_ERROR" });
  }
}
