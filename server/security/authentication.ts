import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Security:Authentication");
import { Request, Response, NextFunction } from "express";
import { dbSystemAdminStorage, dbUserStorage } from "../repositories";
import crypto from "crypto";
import { isPublicApiPath } from "../bootstrap/public-api-paths";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";
import { DEV_BYPASS_USER_ID, isDevAuthBypassEnabled } from "./dev-auth";

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requireAuthentication(req: Request, res: Response, next: NextFunction) {
  try {
    if (isPublicApiPath(req)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const hasBearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ");

    if (isDevAuthBypassEnabled() && !hasBearerToken) {
      // Push B1: dev mock user carries the legacy DEFAULT_ORG_ID so
      // unmigrated dev workflows keep working. In REQUIRE_TENANT_AUTH
      // mode this still works because the dev user does have an orgId
      // claim — it's just the default one.
      //
      // IMPORTANT: only fall back to the mock admin when the caller did NOT
      // present a real session token. A real portal login (e.g. a regular
      // user changing their own password) sends `Authorization: Bearer …`;
      // if we forced the mock admin here, self-service flows like
      // /api/me/change-password would silently operate on the dev admin
      // instead of the logged-in user and always fail.
      req.user = {
        id: DEV_BYPASS_USER_ID,
        email: "admin@example.com",
        role: "admin",
        name: "Development Admin",
        isActive: true,
        orgId: DEFAULT_ORG_ID,
      };
      return next();
    }

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

    const tokenHash = hashSessionToken(token);
    const session = await dbSystemAdminStorage.getAdminSessionByToken(tokenHash);

    if (session) {
      if (new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({
          error: "Session expired",
          code: "SESSION_EXPIRED",
          message: "Your session has expired. Please log in again.",
        });
      }

      await dbSystemAdminStorage.updateAdminSessionActivity(session.id);

      // Push B1: source orgId from the persisted user record. In legacy
      // mode (REQUIRE_TENANT_AUTH unset) we still auto-provision the
      // admin user under DEFAULT_ORG_ID so existing single-tenant boots
      // keep working. In tenant-auth mode the session MUST already have
      // a `userId` pointing at a real user — there's no safe "default
      // tenant" to land in.
      const tenantAuth = requireTenantAuth();
      let user = session.userId
        ? await dbUserStorage.getUser(session.userId)
        : tenantAuth
          ? null
          : await dbUserStorage.getUserByEmail(
              session.adminEmail || "admin@example.com",
              DEFAULT_ORG_ID
            );

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
