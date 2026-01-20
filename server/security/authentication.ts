/**
 * Authentication Middleware - User authentication
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

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

    const validAdminToken = process.env.ADMIN_TOKEN;

    if (!validAdminToken) {
      console.error(
        "ADMIN_TOKEN environment variable is not configured. Admin endpoints disabled for security."
      );
      return res.status(503).json({
        error: "Admin service unavailable",
        code: "ADMIN_SERVICE_DISABLED",
        message: "Admin authentication is not configured. Contact system administrator.",
      });
    }

    if (token !== validAdminToken) {
      return res.status(401).json({
        error: "Invalid token",
        code: "INVALID_TOKEN",
        message: "Provided token is invalid or expired",
      });
    }

    const mockOrgId = "default-org-id";
    let user = await storage.getUserByEmail("admin@example.com", mockOrgId);

    if (!user) {
      user = await storage.createUser({
        orgId: mockOrgId,
        email: "admin@example.com",
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

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication service unavailable", code: "AUTH_ERROR" });
  }
}
