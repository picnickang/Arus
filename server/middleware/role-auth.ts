/**
 * Role-Based Access Control Middleware
 * Restricts access to specific crew roles
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Middleware:RoleAuth");
import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";

export type CrewRole =
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
  | "admin";

const PARTS_MANAGEMENT_ROLES: CrewRole[] = ["chief_engineer", "second_engineer"];

export function requireRole(...allowedRoles: CrewRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (process.env['NODE_ENV'] === "development" && !user) {
      logger.info("[DEV MODE] Role check bypassed - no user attached");
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

    const userRole = user.role?.toLowerCase() as CrewRole;

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
