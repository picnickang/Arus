import type { Express, Request, Response } from "express";
import { roleDashboardConfigSchema } from "@shared/role-dashboard";
import { crewAdminService } from "../../service";
import { authenticatedRequest, requireOrgId } from "../../../../middleware/auth";
import { withErrorHandling } from "../../../../lib/route-utils";
import {
  auditCrewAdminChange as audit,
  handleCrewError,
  requireCrewAdminRole,
  roleDashboardParamsSchema,
  type CrewAdminRouteContext,
} from "./shared";

export function registerCrewAdminDashboardRoutes(app: Express, context: CrewAdminRouteContext): void {
  const { generalApiRateLimit, writeLimit } = context;
  /* ----------------------- Dashboard configs ----------------------- */

  app.get(
    "/api/admin/role-dashboards",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("list role dashboards", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      return res.json(await crewAdminService.listDashboardConfigs(orgId));
    })
  );

  app.get(
    "/api/admin/role-dashboards/:roleId",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get role dashboard", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { roleId } = roleDashboardParamsSchema.parse(req.params);
      try {
        return res.json(await crewAdminService.getDashboardConfig(authReq.orgId, roleId));
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.put(
    "/api/admin/role-dashboards/:roleId",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("save role dashboard", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { roleId } = roleDashboardParamsSchema.parse(req.params);
      const data = roleDashboardConfigSchema.parse(req.body);
      try {
        const config = await crewAdminService.saveDashboardConfig(
          authReq.orgId,
          roleId,
          data,
          authReq.user?.id
        );
        await audit(authReq, "config_updated", "role_dashboard", roleId);
        return res.json(config);
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/admin/role-dashboards/:roleId/reset",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("reset role dashboard", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { roleId } = roleDashboardParamsSchema.parse(req.params);
      try {
        const config = await crewAdminService.resetDashboardConfig(authReq.orgId, roleId);
        await audit(authReq, "config_updated", "role_dashboard", roleId, {
          reset: true,
        });
        return res.json(config);
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );
}
