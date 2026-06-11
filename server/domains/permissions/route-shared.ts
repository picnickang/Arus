import type { Request, Response } from "express";
import { isSuperAdminRole } from "@shared/role-dashboard";
import { jsonRecordSchema } from "@shared/validation/json";
import { z } from "zod";
import { authenticatedRequest } from "../../middleware/auth";
import { isDevAuthBypassEnabled, isDevBypassUser } from "../../security/dev-auth";

export const DEV_ORG_ID = "default-org-id";
export const DEV_USER_ID = "dev-user-id";

export const idParamSchema = z.object({ id: z.string().min(1) });
export const userIdParamSchema = z.object({ userId: z.string().min(1) });
export const userIdRoleIdParamSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});
export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export const fromTemplateBodySchema = z.object({
  templateId: z.string().min(1),
  overrides: jsonRecordSchema.optional(),
});

export function requireSuperAdminForPermissions(req: Request, res: Response, next: () => void) {
  const sessionUser = authenticatedRequest(req).user ?? null;
  const isDevBypass = isDevAuthBypassEnabled() && isDevBypassUser(sessionUser?.id);
  if (!isDevBypass && !isSuperAdminRole(sessionUser?.role)) {
    res.status(403).json({
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only a Super Admin can change roles and permissions.",
    });
    return;
  }
  next();
}
