/**
 * Permission Middleware - Route-level Authorization
 *
 * Provides Express middleware for checking permissions on routes.
 * Uses the permission service for authorization checks.
 *
 * NOTE: This module is in shared infrastructure (server/lib/) to allow
 * domain route files to use it without violating domain boundaries.
 * The actual permission logic is in server/domains/permissions/service.ts.
 */

import type { Request, Response, NextFunction } from "express";
import { permissionService } from "../domains/permissions/service";
import type { ActionCode } from "../config/permission-registry";

type AuthenticatedRequest = Request;

export function requirePermission(resource: string, action: ActionCode) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const orgId = authReq.orgId;

    if (!userId) {
      res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        error: "Unauthorized",
      });
      return;
    }

    if (!orgId) {
      res.status(400).json({
        code: "MISSING_ORG",
        message: "Organization context required",
        error: "Bad Request",
      });
      return;
    }

    const result = await permissionService.authorize(userId, orgId, resource, action);

    if (!result.allowed) {
      res.status(403).json({
        code: "INSUFFICIENT_PERMISSIONS",
        message: result.reason || `You do not have permission to ${action} ${resource}`,
        error: "Forbidden",
        resource,
        action,
      });
      return;
    }

    next();
  };
}

export function requireAnyPermission(resource: string, actions: ActionCode[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const orgId = authReq.orgId;

    if (!userId || !orgId) {
      res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        error: "Unauthorized",
      });
      return;
    }

    const hasAny = await permissionService.hasAnyPermission(userId, orgId, resource, actions);

    if (!hasAny) {
      res.status(403).json({
        code: "INSUFFICIENT_PERMISSIONS",
        message: `You do not have any of the required permissions for ${resource}`,
        error: "Forbidden",
        resource,
        requiredActions: actions,
      });
      return;
    }

    next();
  };
}

export function requireAllPermissions(checks: Array<{ resource: string; action: ActionCode }>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const orgId = authReq.orgId;

    if (!userId || !orgId) {
      res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Authentication required",
        error: "Unauthorized",
      });
      return;
    }

    const hasAll = await permissionService.hasAllPermissions(userId, orgId, checks);

    if (!hasAll) {
      res.status(403).json({
        code: "INSUFFICIENT_PERMISSIONS",
        message: "You do not have all required permissions for this action",
        error: "Forbidden",
        requiredPermissions: checks,
      });
      return;
    }

    next();
  };
}

export async function attachUserPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const orgId = authReq.orgId;

  if (!userId || !orgId) {
    next();
    return;
  }

  try {
    const permissions = await permissionService.compileUserPermissions(userId, orgId);
    (authReq as unknown as Record<string, unknown>)["permissions"] = permissions;
  } catch (error) {
    // Log but don't fail the request
    console.error("Failed to attach user permissions:", error);
  }

  next();
}

export function checkPermissionInDev(resource: string, action: ActionCode) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (process.env["NODE_ENV"] === "development") {
      next();
      return;
    }

    return requirePermission(resource, action)(req, res, next);
  };
}
