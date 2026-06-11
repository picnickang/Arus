import type { Response } from "express";
import { z } from "zod";
import { isHubId } from "@shared/role-dashboard";
import { auditService } from "../../../../compliance/immutable-audit";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { requireRole } from "../../../../middleware/role-auth";
import type { RateLimit } from "../../../../lib/rate-limit-factory";
import { CrewAdminError } from "../../service";

export interface CrewAdminRouteContext {
  generalApiRateLimit: RateLimit;
  writeLimit: RateLimit;
}

export const CREW_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"] as const;
export const requireCrewAdminRole = requireRole(...CREW_ADMIN_ROLES);

// Granting / revoking hub-admin access and editing the access model is a
// SUPER-admin-only capability. The super-admin tier is exactly
// super_admin / system_admin / company_admin — deliberately EXCLUDING the
// regular `admin` access level, which reaches the admin hub but cannot rewrite
// who can see what. Mirrors SUPER_ADMIN_ROLE_KEYS in shared/role-dashboard.ts;
// kept as a local constant so this authz boundary is self-contained and cannot
// be widened by an unrelated edit.
export const HUB_GRANT_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin"] as const;
export const requireSuperAdminRole = requireRole(...HUB_GRANT_ADMIN_ROLES);

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(2).max(100),
  description: z.string().optional(),
  department: z.string().optional(),
  hierarchyLevel: z.number().int().min(1).max(100).optional(),
});

export const updateRoleSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  department: z.string().optional(),
  hierarchyLevel: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const assignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        vesselId: z.string().min(1).nullable().optional(),
        department: z.string().min(1).nullable().optional(),
      })
    )
    .max(100),
});

export const roleChangeSchema = z.object({ role: z.string().min(2).max(50) });
export const roleAssignmentsSchema = z.object({
  roleIds: z.array(z.string().min(1)).max(20),
});
export const loginEnabledSchema = z.object({ enabled: z.boolean() });
export const credentialsSchema = z.object({
  username: z.string().min(3).max(60).optional(),
  password: z.string().min(8).max(128).optional(),
  loginEnabled: z.boolean().optional(),
});
export const resetPasswordSchema = z.object({ password: z.string().min(8).max(128) });
export const supervisorSchema = z.object({ supervisorUserId: z.string().min(1).nullable() });
export const hubAccessSchema = z.object({
  hubAdmin: z.boolean(),
  // Reject unknown hub ids with a 400 rather than silently normalising them
  // away — the allow-list must reference only canonical nav hubs.
  hubAccess: z
    .array(z.string().min(1))
    .max(20)
    .refine((arr) => arr.every(isHubId), {
      message: "hubAccess contains an unknown hub id",
    })
    .nullable()
    .optional(),
});
export const createCrewAccountSchema = z.object({
  username: z.string().min(3).max(60),
  password: z.string().min(8).max(128),
  role: z.string().min(2).max(50).optional(),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(255).optional(),
  loginEnabled: z.boolean().optional(),
  vesselId: z.string().min(1).nullable().optional(),
  skipVesselAssignment: z.boolean().optional(),
});
export const linkAccountSchema = z.object({ userId: z.string().min(1) });
export const idParamsSchema = z.object({ id: z.string().min(1) });
export const roleDashboardParamsSchema = z.object({ roleId: z.string().min(1) });
export const crewMemberParamsSchema = z.object({ crewId: z.string().min(1) });

export function statusForError(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "RESERVED_ROLE":
    case "DUPLICATE_ROLE":
    case "PROTECTED_ROLE":
    case "ROLE_IN_USE":
    case "ADMIN_LOCKOUT":
    case "CREW_ALREADY_LINKED":
    case "USER_ALREADY_LINKED":
    case "DUPLICATE_USERNAME":
      return 409;
    case "ADMIN_ROLE_PROTECTED":
      return 409;
    case "INVALID_CONFIG":
    case "INVALID_VESSEL":
    case "INVALID_USERNAME":
    case "INVALID_SUPERVISOR":
    case "INVALID_ROLE":
    case "ROLE_NOT_ELIGIBLE":
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
    case "INVALID_CHARACTERS":
    case "EMAIL_REQUIRED":
      return 400;
    default:
      return 400;
  }
}

export function handleCrewError(error: unknown, res: Response): boolean {
  if (error instanceof CrewAdminError) {
    res.status(statusForError(error.code)).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

export async function auditCrewAdminChange(
  authReq: AuthenticatedRequest,
  eventType: Parameters<typeof auditService.logEvent>[0]["eventType"],
  entityType: string,
  entityId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await auditService.logEvent({
    orgId: authReq.orgId,
    eventCategory: "configuration_change",
    eventType,
    entityType,
    entityId,
    performedBy: authReq.user?.id ?? "unknown",
    performedByRole: authReq.user?.role,
    ...(extra ? { newState: extra } : {}),
  });
}
