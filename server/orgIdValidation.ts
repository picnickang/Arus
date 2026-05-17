// Canonical single-tenant org validation.
//
// ARUS currently runs as a single-tenant, multi-vessel system. The application
// still uses org_id columns for traceability and future migration paths, but
// callers must not be able to select an arbitrary org with x-org-id.
import type { Request, Response, NextFunction } from "express";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function suppliedOrgId(req: Request): string | undefined {
  const header = req.headers["x-org-id"];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const queryValue = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  return headerValue ?? queryValue;
}

function applyDefaultOrgContext(req: Request): void {
  (req as any).orgId = DEFAULT_ORG_ID;
  req.headers["x-org-id"] = DEFAULT_ORG_ID;
  if (req.query) {
    req.query.orgId = DEFAULT_ORG_ID;
  }
}

export function requireOrgId(req: Request, _res: Response, next: NextFunction): void {
  applyDefaultOrgContext(req);
  next();
}

export function validateOrgId(orgId: string): boolean {
  return ORG_ID_PATTERN.test(orgId) && orgId === DEFAULT_ORG_ID;
}

export function getOrgIdFromRequest(req: Request): string {
  return DEFAULT_ORG_ID;
}

export function validateOrgIdHeader(req: Request, res: Response, next: NextFunction): void {
  const requestedOrgId = suppliedOrgId(req);

  if (!requestedOrgId) {
    applyDefaultOrgContext(req);
    return next();
  }

  const normalized = requestedOrgId.trim();
  if (!validateOrgId(normalized)) {
    res.status(403).json({
      error: "Invalid organization context for single-tenant deployment",
      code: "ORG_CONTEXT_FORBIDDEN",
    });
    return;
  }

  applyDefaultOrgContext(req);
  next();
}
