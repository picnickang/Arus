import { Request, Response, NextFunction } from "express";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";

/**
 * Push B1 — Multi-tenancy with Postgres RLS.
 *
 * When `REQUIRE_TENANT_AUTH=true`:
 *   - Unauthenticated `/api/*` requests fail with 401.
 *   - `req.orgId` is sourced from `req.user.orgId` (which auth middleware
 *     pulls off the session claim). No DEFAULT_ORG_ID fallback.
 *   - A user whose record is missing `orgId` is treated as misconfigured
 *     and rejected with 401.
 *
 * When `REQUIRE_TENANT_AUTH` is unset (legacy single-tenant mode), the
 * pre-B1 behaviour is preserved: missing user still rejects (auth was
 * always required for traceability) but `orgId` defaults to
 * `DEFAULT_ORG_ID` so existing single-tenant deployments keep working.
 */

export interface AuthenticatedRequest extends Request {
  orgId: string;
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    isActive: boolean;
    orgId?: string;
  };
  session?: {
    user?: {
      id: string;
      email?: string;
      role?: string;
      name?: string;
    };
    [key: string]: unknown;
  };
}

function resolveOrgId(authReq: AuthenticatedRequest): { orgId?: string; error?: string } {
  const claim = authReq.user?.orgId;
  if (requireTenantAuth()) {
    if (!claim || typeof claim !== "string" || claim.trim() === "") {
      return { error: "TENANT_CLAIM_MISSING" };
    }
    return { orgId: claim };
  }
  return { orgId: claim || DEFAULT_ORG_ID };
}

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

  const { orgId, error } = resolveOrgId(authReq);
  if (error || !orgId) {
    return res.status(401).json({
      message: "Authenticated user has no organization claim",
      code: error ?? "TENANT_CLAIM_MISSING",
    }) as any;
  }

  authReq.orgId = orgId;
  next();
}

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

  const { orgId, error } = resolveOrgId(authReq);
  if (error || !orgId) {
    return res.status(401).json({
      message: "Authenticated user has no organization claim",
      code: error ?? "TENANT_CLAIM_MISSING",
    }) as any;
  }

  authReq.orgId = orgId;
  if (req.body) {
    req.body.orgId = orgId;
  }

  next();
}

/**
 * Used by a small number of endpoints where authentication is optional
 * (e.g. health probes). In tenant-auth mode we still cannot invent an
 * org id out of thin air, so callers either get the authenticated user's
 * org or nothing at all — they MUST cope with `req.orgId` being absent.
 */
export async function optionalOrgId(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method === "OPTIONS") {
    return next();
  }
  const authReq = req as AuthenticatedRequest;
  const { orgId } = resolveOrgId(authReq);
  if (orgId) {
    authReq.orgId = orgId;
  }
  next();
}
