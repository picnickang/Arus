import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import crypto from "crypto";

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

    const tokenHash = hashSessionToken(token);
    const session = await storage.getAdminSessionByToken(tokenHash);

    if (session) {
      if (new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({
          error: "Session expired",
          code: "SESSION_EXPIRED",
          message: "Your session has expired. Please log in again.",
        });
      }

      await storage.updateAdminSessionActivity(session.id);

      const mockOrgId = "default-org-id";
      let user = session.userId
        ? await storage.getUser(session.userId)
        : await storage.getUserByEmail(session.adminEmail || "admin@example.com", mockOrgId);

      if (!user) {
        user = await storage.createUser({
          orgId: mockOrgId,
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
      };

      return next();
    }

    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
      message: "Provided token is invalid or expired. Please log in again.",
    });
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication service unavailable", code: "AUTH_ERROR" });
  }
}
