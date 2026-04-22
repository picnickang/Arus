/**
 * Authorization Middleware - Role validation
 *
 * SINGLE-TENANT SYSTEM: Org validation removed (uses default-org-id)
 * User roles still enforced for access control
 */

import { Request, Response, NextFunction } from "express";
import { requireAuthentication } from "./authentication";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      code: "INSUFFICIENT_PRIVILEGES",
      requiredRole: "admin",
      userRole: req.user.role,
    });
  }

  next();
}

/**
 * SINGLE-TENANT: Always sets default org ID
 * Cross-org validation removed (single tenant)
 */
export function validateOrganizationAccess(req: Request, _res: Response, next: NextFunction) {
  // SINGLE-TENANT: Set default org ID
  req.orgId = DEFAULT_ORG_ID;

  if (req.method === "GET" && req.query) {
    req.query.orgId = DEFAULT_ORG_ID;
  } else if (req.body && typeof req.body === "object") {
    req.body.orgId = DEFAULT_ORG_ID;
  }

  next();
}

export const requireAdminAuth = [
  requireAuthentication,
  requireAdminRole,
  validateOrganizationAccess,
];
