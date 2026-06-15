/**
 * Role-Based Access Control Middleware
 * Restricts access to specific crew roles
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:RoleAuth");
import type { Request, Response, NextFunction } from "express";
import { authenticatedRequest } from "./auth";

export type AuthCrewRole =
  | "chief_engineer"
  | "second_engineer"
  | "third_engineer"
  | "fourth_engineer"
  | "captain"
  | "chief_officer"
  | "second_officer"
  | "third_officer"
  | "bosun"
  | "able_seaman"
  | "ordinary_seaman"
  | "oiler"
  | "wiper"
  | "cook"
  | "steward"
  | "cadet"
  | "super_admin"
  | "admin"
  // Portal-level admin roles (see client role-navigation-policy).
  // Included so `requireRole(...)` can gate routes by portal, not
  // just shipboard crew rank — the runtime check is a plain string
  // compare against `user.role.toLowerCase()`.
  | "system_admin"
  | "company_admin"
  | "fleet_manager"
  | "vessel_master"
  | "supervisor"
  | "logistics_user"
  | "safety_officer"
  | "crew_member"
  | "deck_officer"
  | "viewer";

const PARTS_MANAGEMENT_ROLES: AuthCrewRole[] = ["chief_engineer", "second_engineer"];

/**
 * LR-3.5 / SEC-1: the previous implementation bypassed the role check
 * whenever `NODE_ENV === "development"` and no user was attached. That
 * branch was a footgun: any deploy where `NODE_ENV` was unset, missing,
 * or stuck on a non-"production" value (CI runners, dev containers,
 * misconfigured prod) effectively disabled RBAC across every admin
 * route. We removed the implicit bypass. Tests that genuinely need to
 * exercise a handler without a user MUST set `RBAC_DEV_NO_AUTH=1`
 * explicitly AND have `NODE_ENV !== "production"` — both conditions
 * are required so a stray env in prod can't reopen the gate. We also
 * read the env at request time so it cannot be frozen at module-load
 * (otherwise a test that mutates env after import would not exercise
 * the gate, and a runtime config rotation would not take effect).
 */
function devBypassAllowed(): boolean {
  return process.env["RBAC_DEV_NO_AUTH"] === "1" && process.env["NODE_ENV"] !== "production";
}

export function requireRole(...allowedRoles: AuthCrewRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = authenticatedRequest(req).user;

    if (devBypassAllowed() && !user) {
      logger.warn("[RBAC] Bypassed via RBAC_DEV_NO_AUTH=1 — must NEVER be set in production");
      return next();
    }

    if (!user) {
      res.status(401).json({
        code: "AUTH_REQUIRED",
        message: "Authentication required",
        error: "Unauthorized",
      });
      return;
    }

    const userRole = user.role?.toLowerCase() as AuthCrewRole;

    // super_admin has all-access across the RBAC surface (consistency with the
    // session-roles checks elsewhere); never gate it behind per-route role lists.
    if (userRole === "super_admin") {
      return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      logger.warn("[RBAC] Access denied", {
        userId: user.id,
        userRole: user.role,
        requiredRoles: allowedRoles,
        endpoint: req.originalUrl,
        timestamp: new Date().toISOString(),
      });

      res.status(403).json({
        code: "INSUFFICIENT_PERMISSIONS",
        message: `Access denied. This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        error: "Forbidden",
      });
      return;
    }

    next();
  };
}

export function requirePartsManagementRole() {
  return requireRole(...PARTS_MANAGEMENT_ROLES);
}
