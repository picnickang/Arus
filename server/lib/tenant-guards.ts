/**
 * Tenant Guard Utilities
 * 
 * SonarQube Fix: Centralized tenant validation logic
 * Eliminates repeated org ID checks scattered across domain routes
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export interface TenantContext {
  orgId: string;
  userId?: string;
  isAdmin?: boolean;
}

export interface TenantValidationOptions {
  allowEmpty?: boolean;
  headerName?: string;
  logAccess?: boolean;
}

const DEFAULT_OPTIONS: TenantValidationOptions = {
  allowEmpty: false,
  headerName: "x-org-id",
  logAccess: false,
};

/**
 * Extract org ID from request (header > query > body)
 */
export function extractOrgId(req: Request, headerName = "x-org-id"): string | undefined {
  return (
    (req.headers[headerName] as string) ||
    (req.query.orgId as string) ||
    (req.body?.orgId as string)
  );
}

/**
 * Validate org ID format (alphanumeric, dashes, underscores)
 */
export function isValidOrgId(orgId: string): boolean {
  if (!orgId || typeof orgId !== "string") {return false;}
  if (orgId.length > 100) {return false;}
  return /^[a-zA-Z0-9_-]+$/.test(orgId);
}

/**
 * Check if user has access to the requested org
 */
export function hasOrgAccess(userOrgId: string | undefined, requestedOrgId: string, isAdmin = false): boolean {
  if (isAdmin) {return true;}
  if (!userOrgId) {return false;}
  return userOrgId === requestedOrgId;
}

/**
 * Create middleware to extract and validate tenant context
 */
export function createTenantExtractor(options: TenantValidationOptions = {}): RequestHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    const orgId = extractOrgId(req, opts.headerName);
    
    if (orgId) {
      if (!isValidOrgId(orgId)) {
        return res.status(400).json({
          error: "Invalid organization ID format",
          code: "INVALID_ORG_ID_FORMAT",
        });
      }
      
      req.orgId = orgId;
      
      if (opts.logAccess) {
        console.log(`[TENANT] ${req.method} ${req.path} orgId=${orgId}`);
      }
    }
    
    next();
  };
}

/**
 * Create middleware to require valid tenant context
 * SINGLE-TENANT MODE: Auto-defaults to default-org-id when missing
 */
export function createTenantRequirement(options: TenantValidationOptions = {}): RequestHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.orgId || extractOrgId(req, opts.headerName) || DEFAULT_ORG_ID;
    
    if (!isValidOrgId(orgId)) {
      return res.status(400).json({
        error: "Invalid organization ID format",
        code: "INVALID_ORG_ID_FORMAT",
      });
    }
    
    req.orgId = orgId;
    next();
  };
}

/**
 * SINGLE-TENANT: Cross-tenant guard is a no-op
 * Kept for API compatibility
 */
export function createCrossTenantGuard(): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction) => {
    // SINGLE-TENANT: No cross-tenant validation needed
    next();
  };
}

/**
 * Compose tenant middleware chain
 */
export function createFullTenantGuard(options: TenantValidationOptions = {}): RequestHandler[] {
  return [
    createTenantExtractor(options),
    createTenantRequirement(options),
    createCrossTenantGuard(),
  ];
}

/**
 * Utility to add orgId to storage queries
 */
export function withTenantFilter<T extends object>(query: T, orgId: string): T & { orgId: string } {
  return { ...query, orgId };
}

/**
 * Validate that a resource belongs to the requesting tenant
 */
export function validateResourceTenant(resourceOrgId: string | undefined, requestOrgId: string): boolean {
  if (!resourceOrgId) {return false;}
  return resourceOrgId === requestOrgId;
}
