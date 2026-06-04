/**
 * Crew Admin Routes (Interfaces Layer)
 * Admin-gated "Crew Management": roles, dashboard configs, user vessel
 * assignments, and login credential admin.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { crewAdminService, CrewAdminError } from "../service";
import { requireOrgId, type AuthenticatedRequest } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role-auth";
import { withErrorHandling } from "../../../lib/route-utils";
import { auditService } from "../../../compliance/immutable-audit";
import { isHubId } from "@shared/role-dashboard";

const CREW_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"] as const;
const requireCrewAdminRole = requireRole(...CREW_ADMIN_ROLES);

// Granting / revoking hub-admin access is a system-administrator-only
// capability. By policy the system-administrator tier is exactly the
// super-admin roles (system_admin / company_admin / admin) — the same
// accounts that are always-full and can never be locked out. They are
// enumerated in a dedicated constant here (rather than reusing a
// lockout-protection list) so this authz boundary is self-contained and
// cannot be widened by an unrelated edit. It is deliberately narrower than
// the broader crew-admin surface.
const HUB_GRANT_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"] as const;
const requireSuperAdminRole = requireRole(...HUB_GRANT_ADMIN_ROLES);

const createRoleSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(2).max(100),
  description: z.string().optional(),
  department: z.string().optional(),
  hierarchyLevel: z.number().int().min(1).max(100).optional(),
});

const updateRoleSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  department: z.string().optional(),
  hierarchyLevel: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

const assignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        vesselId: z.string().min(1).nullable().optional(),
        department: z.string().min(1).nullable().optional(),
      }),
    )
    .max(100),
});

const roleChangeSchema = z.object({ role: z.string().min(2).max(50) });
const roleAssignmentsSchema = z.object({
  roleIds: z.array(z.string().min(1)).max(20),
});
const loginEnabledSchema = z.object({ enabled: z.boolean() });
const credentialsSchema = z.object({
  username: z.string().min(3).max(60).optional(),
  password: z.string().min(8).max(128).optional(),
  loginEnabled: z.boolean().optional(),
});
const resetPasswordSchema = z.object({ password: z.string().min(8).max(128) });
const supervisorSchema = z.object({ supervisorUserId: z.string().min(1).nullable() });
const hubAccessSchema = z.object({
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
const createCrewAccountSchema = z.object({
  username: z.string().min(3).max(60),
  password: z.string().min(8).max(128),
  role: z.string().min(2).max(50).optional(),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(255).optional(),
  loginEnabled: z.boolean().optional(),
  vesselId: z.string().min(1).nullable().optional(),
  skipVesselAssignment: z.boolean().optional(),
});
const linkAccountSchema = z.object({ userId: z.string().min(1) });

function statusForError(code: string): number {
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

function handleCrewError(error: unknown, res: Response): boolean {
  if (error instanceof CrewAdminError) {
    res.status(statusForError(error.code)).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

export function registerCrewAdminRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    writeOperationRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  },
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimit;
  const writeLimit = writeOperationRateLimit || generalApiRateLimit;

  async function audit(
    authReq: AuthenticatedRequest,
    eventType: Parameters<typeof auditService.logEvent>[0]["eventType"],
    entityType: string,
    entityId: string,
    extra?: Record<string, unknown>,
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

  /* ------------------------------ Roles ---------------------------- */

  app.get(
    "/api/admin/crew/roles",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list crew roles", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      return res.json(await crewAdminService.listRoles(orgId));
    }),
  );

  app.post(
    "/api/admin/crew/roles",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("create crew role", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const data = createRoleSchema.parse(req.body);
      try {
        const role = await crewAdminService.createRole({ ...data, orgId: authReq.orgId });
        await audit(authReq, "create", "role", role.id, { name: role.name });
        return res.status(201).json(role);
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.patch(
    "/api/admin/crew/roles/:id",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("update crew role", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const data = updateRoleSchema.parse(req.body);
      try {
        const role = await crewAdminService.updateRole(authReq.orgId, req.params['id'], data);
        await audit(authReq, "update", "role", role.id, { changed: Object.keys(data) });
        return res.json(role);
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.delete(
    "/api/admin/crew/roles/:id",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("delete crew role", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        await crewAdminService.deleteRole(authReq.orgId, req.params['id']);
        await audit(authReq, "delete", "role", req.params['id']);
        return res.status(204).send();
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.patch(
    "/api/admin/crew/roles/:id/hub-access",
    requireOrgId,
    requireSuperAdminRole,
    writeLimit,
    withErrorHandling("set crew role hub access", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { hubAdmin, hubAccess } = hubAccessSchema.parse(req.body);
      try {
        const role = await crewAdminService.setRoleHubAccess(
          authReq.orgId,
          req.params['id'],
          hubAdmin,
          hubAccess ?? null,
        );
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "role",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { hubAdmin: role.hubAdmin, hubAccess: role.hubAccess },
        });
        return res.json(role);
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* ----------------------- Dashboard configs ----------------------- */

  app.get(
    "/api/admin/role-dashboards",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list role dashboards", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      return res.json(await crewAdminService.listDashboardConfigs(orgId));
    }),
  );

  app.get(
    "/api/admin/role-dashboards/:roleId",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get role dashboard", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        return res.json(await crewAdminService.getDashboardConfig(authReq.orgId, req.params['roleId']));
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.put(
    "/api/admin/role-dashboards/:roleId",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("save role dashboard", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        const config = await crewAdminService.saveDashboardConfig(
          authReq.orgId,
          req.params['roleId'],
          req.body,
          authReq.user?.id,
        );
        await audit(authReq, "config_updated", "role_dashboard", req.params['roleId']);
        return res.json(config);
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/admin/role-dashboards/:roleId/reset",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("reset role dashboard", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        const config = await crewAdminService.resetDashboardConfig(
          authReq.orgId,
          req.params['roleId'],
        );
        await audit(authReq, "config_updated", "role_dashboard", req.params['roleId'], {
          reset: true,
        });
        return res.json(config);
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* ----------------------- Users + assignments --------------------- */

  app.get(
    "/api/admin/crew/users",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list crew users", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      return res.json(await crewAdminService.listUsers(orgId));
    }),
  );

  app.get(
    "/api/admin/crew/access-readiness",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list crew access readiness", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      return res.json(await crewAdminService.listCrewAccessReadiness(orgId));
    }),
  );

  app.get(
    "/api/admin/crew/former-access-risks",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list former crew access risks", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      return res.json(await crewAdminService.listFormerCrewAccessRisks(orgId));
    }),
  );

  app.get(
    "/api/admin/crew/users/:id/assignments",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get crew user assignments", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      return res.json(await crewAdminService.getAssignments(orgId, req.params['id']));
    }),
  );

  app.put(
    "/api/admin/crew/users/:id/assignments",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user assignments", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { assignments } = assignmentsSchema.parse(req.body);
      try {
        const result = await crewAdminService.setAssignments(
          authReq.orgId,
          req.params['id'],
          assignments,
          authReq.user?.id,
        );
        await audit(authReq, "update", "user_vessel_assignment", req.params['id'], {
          count: result.length,
        });
        return res.json(result);
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.patch(
    "/api/admin/crew/users/:id/role",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("change crew user role", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { role } = roleChangeSchema.parse(req.body);
      try {
        await crewAdminService.changeRole(authReq.orgId, req.params['id'], role);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "user",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { role },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.get(
    "/api/admin/crew/users/:id/roles",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get crew user roles", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      try {
        return res.json(await crewAdminService.getRoleAssignments(orgId, req.params['id']));
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.put(
    "/api/admin/crew/users/:id/roles",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user roles", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { roleIds } = roleAssignmentsSchema.parse(req.body);
      try {
        await crewAdminService.setRoleAssignments(
          authReq.orgId,
          req.params['id'],
          roleIds,
          authReq.user?.id,
        );
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "user_role_assignment",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { roleIds },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.patch(
    "/api/admin/crew/users/:id/supervisor",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user supervisor", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { supervisorUserId } = supervisorSchema.parse(req.body);
      try {
        await crewAdminService.setSupervisor(authReq.orgId, req.params['id'], supervisorUserId);
        await audit(authReq, "update", "user", req.params['id'], { supervisorUserId });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.patch(
    "/api/admin/crew/users/:id/hub-access",
    requireOrgId,
    requireSuperAdminRole,
    writeLimit,
    withErrorHandling("set crew user hub access", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { hubAdmin, hubAccess } = hubAccessSchema.parse(req.body);
      try {
        await crewAdminService.setHubAccess(
          authReq.orgId,
          req.params['id'],
          hubAdmin,
          hubAccess ?? null,
        );
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "user",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { hubAdmin, hubAccess: hubAccess ?? null },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* ----------------------------- Credentials ----------------------- */

  app.patch(
    "/api/admin/crew/users/:id/login-enabled",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("toggle crew user login", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { enabled } = loginEnabledSchema.parse(req.body);
      try {
        await crewAdminService.setLoginEnabled(authReq.orgId, req.params['id'], enabled);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { loginEnabled: enabled },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/admin/crew/users/:id/credentials",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user credentials", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const data = credentialsSchema.parse(req.body);
      try {
        await crewAdminService.setCredentials({
          orgId: authReq.orgId,
          userId: req.params['id'],
          ...data,
        });
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user_credentials",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          changedFields: Object.keys(data),
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/admin/crew/users/:id/reset-password",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("reset crew user password", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { password } = resetPasswordSchema.parse(req.body);
      try {
        await crewAdminService.resetPassword(authReq.orgId, req.params['id'], password);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user_credentials",
          entityId: req.params['id'],
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { passwordReset: true },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* -------------------- Crew member login accounts ------------------ */

  app.get(
    "/api/admin/crew/members/:crewId/account",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get crew member account", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        const account = await crewAdminService.getCrewAccount(
          authReq.orgId,
          req.params['crewId'],
        );
        return res.json({ account });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/admin/crew/members/:crewId/account",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("create crew member account", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const data = createCrewAccountSchema.parse(req.body);
      try {
        const account = await crewAdminService.createAndLinkAccount({
          orgId: authReq.orgId,
          crewId: req.params['crewId'],
          assignedBy: authReq.user?.id,
          ...data,
        });
        await audit(authReq, "config_updated", "crew_account", account.id, {
          action: "create_and_link",
          crewId: req.params['crewId'],
          role: account.role,
        });
        return res.status(201).json({ account });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/admin/crew/members/:crewId/link",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("link crew member account", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const { userId } = linkAccountSchema.parse(req.body);
      try {
        await crewAdminService.linkExistingAccount(
          authReq.orgId,
          req.params['crewId'],
          userId,
        );
        await audit(authReq, "config_updated", "crew_account", userId, {
          action: "link",
          crewId: req.params['crewId'],
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.delete(
    "/api/admin/crew/members/:crewId/account",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("unlink crew member account", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      try {
        await crewAdminService.unlinkAccount(authReq.orgId, req.params['crewId']);
        await audit(authReq, "config_updated", "crew_account", req.params['crewId'], {
          action: "unlink",
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) return undefined;
        throw error;
      }
    }),
  );
}
