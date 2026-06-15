import type { Express, Request, Response } from "express";
import { crewAdminService } from "../../service";
import { authenticatedRequest, requireOrgId } from "../../../../middleware/auth";
import { withErrorHandling } from "../../../../lib/route-utils";
import { auditService } from "../../../../compliance/immutable-audit";
import {
  assignmentsSchema,
  auditCrewAdminChange as audit,
  handleCrewError,
  hubAccessSchema,
  idParamsSchema,
  requireCrewAdminRole,
  requireSuperAdminRole,
  roleAssignmentsSchema,
  roleChangeSchema,
  supervisorSchema,
  type CrewAdminRouteContext,
} from "./shared";

export function registerCrewAdminUserRoutes(app: Express, context: CrewAdminRouteContext): void {
  const { generalApiRateLimit, writeLimit } = context;
  /* ----------------------- Users + assignments --------------------- */

  app.get(
    "/api/admin/crew/users",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list crew users", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      return res.json(await crewAdminService.listUsers(orgId));
    })
  );

  app.get(
    "/api/admin/crew/access-readiness",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list crew access readiness", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      return res.json(await crewAdminService.listCrewAccessReadiness(orgId));
    })
  );

  app.get(
    "/api/admin/crew/former-access-risks",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list former crew access risks", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      return res.json(await crewAdminService.listFormerCrewAccessRisks(orgId));
    })
  );

  app.get(
    "/api/admin/crew/users/:id/assignments",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get crew user assignments", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamsSchema.parse(req.params);
      return res.json(await crewAdminService.getAssignments(orgId, id));
    })
  );

  app.put(
    "/api/admin/crew/users/:id/assignments",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user assignments", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { assignments } = assignmentsSchema.parse(req.body);
      try {
        const result = await crewAdminService.setAssignments(
          authReq.orgId,
          id,
          assignments,
          authReq.user?.id
        );
        await audit(authReq, "update", "user_vessel_assignment", id, {
          count: result.length,
        });
        return res.json(result);
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.patch(
    "/api/admin/crew/users/:id/role",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("change crew user role", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { role } = roleChangeSchema.parse(req.body);
      try {
        await crewAdminService.changeRole(authReq.orgId, id, role);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "user",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { role },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.get(
    "/api/admin/crew/users/:id/roles",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get crew user roles", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamsSchema.parse(req.params);
      try {
        return res.json(await crewAdminService.getRoleAssignments(orgId, id));
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.put(
    "/api/admin/crew/users/:id/roles",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user roles", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { roleIds } = roleAssignmentsSchema.parse(req.body);
      try {
        await crewAdminService.setRoleAssignments(authReq.orgId, id, roleIds, authReq.user?.id);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "user_role_assignment",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { roleIds },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.patch(
    "/api/admin/crew/users/:id/supervisor",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user supervisor", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { supervisorUserId } = supervisorSchema.parse(req.body);
      try {
        await crewAdminService.setSupervisor(authReq.orgId, id, supervisorUserId);
        await audit(authReq, "update", "user", id, { supervisorUserId });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.patch(
    "/api/admin/crew/users/:id/hub-access",
    requireOrgId,
    requireSuperAdminRole,
    writeLimit,
    withErrorHandling("set crew user hub access", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { hubAdmin, hubAccess } = hubAccessSchema.parse(req.body);
      try {
        await crewAdminService.setHubAccess(authReq.orgId, id, hubAdmin, hubAccess ?? null);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "user",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { hubAdmin, hubAccess: hubAccess ?? null },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );
}
