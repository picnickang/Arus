import { Request, Response, NextFunction } from "express";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

/**
 * SINGLE-TENANT SYSTEM
 *
 * This is a single-tenant, multi-vessel, multi-user system.
 * - No org isolation required (single tenant)
 * - Multi-vessel: Vessels are the organizational unit
 * - Multi-user: Users are tracked for traceability (userId, createdBy, updatedBy)
 * - All audit logs preserve user actions for accountability
 */

export interface AuthenticatedRequest extends Request {
  orgId: string;
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    isActive: boolean;
  };
}

/**
 * SINGLE-TENANT: Always sets default org ID
 * SECURITY: Still requires authenticated user for traceability
 */
export async function requireOrgId(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({
      message: "Authentication required",
      code: "UNAUTHENTICATED",
    }) as any;
  }

  authReq.orgId = DEFAULT_ORG_ID;
  next();
}

/**
 * SINGLE-TENANT: Always sets default org ID, injects into body if present
 * SECURITY: Still requires authenticated user for traceability
 */
export async function requireOrgIdAndValidateBody(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({
      message: "Authentication required",
      code: "UNAUTHENTICATED",
    }) as any;
  }

  authReq.orgId = DEFAULT_ORG_ID;

  if (req.body) {
    req.body.orgId = DEFAULT_ORG_ID;
  }

  next();
}

/**
 * SINGLE-TENANT: Always sets default org ID
 */
export async function optionalOrgId(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method === "OPTIONS") {
    return next();
  }
  (req as AuthenticatedRequest).orgId = DEFAULT_ORG_ID;
  next();
}
