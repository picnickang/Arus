/**
 * Authorization Middleware - Role validation
 *
 * SINGLE-TENANT SYSTEM: Org validation removed (uses default-org-id)
 * User roles still enforced for access control
 */

import { Request, Response, NextFunction } from "express";
import { requireAuthentication } from "./authentication";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { isSuperAdminRole } from "@shared/role-dashboard";

export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
  }

  // Accept "admin" plus the super-admin set the FRONTEND admin gate uses
  // (SUPER_ADMIN_ROLE_KEYS in shared/role-dashboard: super_admin,
  // system_admin, company_admin). The previous strict `role !== "admin"`
  // check made the two gates mutually exclusive: the Admin Portal only
  // admits super-admin roles, while every /api/admin route rejected
  // them — so no single account could both reach the admin UI and call
  // its APIs (e.g. the dev-login admin persona, role super_admin, was
  // 403'd by /api/admin/telemetry/stress-test).
  if (req.user.role !== "admin" && !isSuperAdminRole(req.user.role)) {
    return res.status(403).json({
      error: "Admin access required",
      code: "INSUFFICIENT_PRIVILEGES",
      requiredRole: "admin (or a super-admin role)",
      userRole: req.user.role,
    });
  }

  next();
  return undefined;
}

/**
 * SINGLE-TENANT: Always sets default org ID
 * Cross-org validation removed (single tenant)
 */
export function validateOrganizationAccess(req: Request, _res: Response, next: NextFunction) {
  // SINGLE-TENANT: Set default org ID
  req.orgId = DEFAULT_ORG_ID;

  if (req.method !== "GET" && req.body && typeof req.body === "object") {
    req.body.orgId = DEFAULT_ORG_ID;
  }

  next();
}

export const requireAdminAuth = [
  requireAuthentication,
  requireAdminRole,
  validateOrganizationAccess,
];
