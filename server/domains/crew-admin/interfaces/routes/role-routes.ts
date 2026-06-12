import type { Express, Request, Response } from "express";
import { crewAdminService } from "../../service";
import { authenticatedRequest, requireOrgId } from "../../../../middleware/auth";
import { withErrorHandling } from "../../../../lib/route-utils";
import { auditService } from "../../../../compliance/immutable-audit";
import {
  auditCrewAdminChange as audit,
  createRoleSchema,
  handleCrewError,
  hubAccessSchema,
  idParamsSchema,
  requireCrewAdminRole,
  requireSuperAdminRole,
  updateRoleSchema,
  type CrewAdminRouteContext,
} from "./shared";

export function registerCrewAdminRoleRoutes(app: Express, context: CrewAdminRouteContext): void {
  const { generalApiRateLimit, writeLimit } = context;
  /* ------------------------------ Roles ---------------------------- */

  app.get(
    "/api/admin/crew/roles",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list crew roles", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      return res.json(await crewAdminService.listRoles(orgId));
    })
  );

  app.post(
    "/api/admin/crew/roles",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("create crew role", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const data = createRoleSchema.parse(req.body);
      try {
        const role = await crewAdminService.createRole({ ...data, orgId: authReq.orgId });
        await audit(authReq, "create", "role", role.id, { name: role.name });
        return res.status(201).json(role);
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.patch(
    "/api/admin/crew/roles/:id",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("update crew role", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const data = updateRoleSchema.parse(req.body);
      try {
        const role = await crewAdminService.updateRole(authReq.orgId, id, data);
        await audit(authReq, "update", "role", role.id, { changed: Object.keys(data) });
        return res.json(role);
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.delete(
    "/api/admin/crew/roles/:id",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("delete crew role", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      try {
        await crewAdminService.deleteRole(authReq.orgId, id);
        await audit(authReq, "delete", "role", id);
        return res.status(204).send();
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.patch(
    "/api/admin/crew/roles/:id/hub-access",
    requireOrgId,
    requireSuperAdminRole,
    writeLimit,
    withErrorHandling("set crew role hub access", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { hubAdmin, hubAccess } = hubAccessSchema.parse(req.body);
      try {
        const { role, previousHubState } = await crewAdminService.setRoleHubAccess(
          authReq.orgId,
          id,
          hubAdmin,
          hubAccess ?? null
        );
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "permission_changed",
          entityType: "role",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          previousState: {
            hubAdmin: previousHubState.hubAdmin,
            hubAccess: previousHubState.hubAccess,
          },
          newState: { hubAdmin: role.hubAdmin, hubAccess: role.hubAccess },
        });
        return res.json(role);
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );
}
