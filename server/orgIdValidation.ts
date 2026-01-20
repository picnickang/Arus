// Single-tenant system - orgId is optional and defaults to shared config value
import type { Request, Response, NextFunction } from "express";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export function requireOrgId(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const orgId = req.headers["x-org-id"] || req.query.orgId || DEFAULT_ORG_ID;
  (req as any).orgId = orgId;
  next();
}

export function validateOrgId(_orgId: string): boolean {
  return true;
}

export function getOrgIdFromRequest(req: Request): string {
  return (req as any).orgId || req.headers["x-org-id"] as string || DEFAULT_ORG_ID;
}

export function validateOrgIdHeader(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next();
}
