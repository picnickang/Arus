import type { Express, Request, Response } from "express";
import { isSuperAdminRole } from "@shared/role-dashboard";
import { structuredLog, type LogContext } from "../../logging";
import { withErrorHandling } from "../../lib/route-utils";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import { isDevAuthBypassEnabled, isDevBypassUser } from "../../security/dev-auth";
import { mapCompiledToContract, type MapperLogger } from "./mapper";
import {
  getCrewLinkForUser,
  getUserDiagnosticRow,
  permissionRepository,
} from "./repository";
import { permissionService, compileUserPermissions } from "./service";
import { DEV_ORG_ID, DEV_USER_ID } from "./route-shared";

export function registerPermissionDevDiagnosticRoute(app: Express) {
  app.get(
    "/api/permissions/dev-diagnostic",
    requireOrgId,
    withErrorHandling("dev access diagnostic", async (req: Request, res: Response) => {
      if (process.env["NODE_ENV"] === "production") {
        return res.status(404).json({ message: "Not found" });
      }

      const authReq = authenticatedRequest(req);
      const sessionUser = authReq.user ?? null;
      const orgId = authReq.orgId || DEV_ORG_ID;

      const isDevBypass = isDevAuthBypassEnabled() && isDevBypassUser(sessionUser?.id);
      if (!isDevBypass && !isSuperAdminRole(sessionUser?.role)) {
        return res.status(403).json({
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Dev diagnostic requires a super-admin role.",
        });
      }

      const userId = sessionUser?.id || DEV_USER_ID;
      const dbUser = await getUserDiagnosticRow(orgId, userId);

      const compiled = await compileUserPermissions(userId, orgId);
      const orgRoles = await permissionRepository.listRoles(orgId);
      const mapperLogger: MapperLogger = {
        warn: (message, context) => structuredLog("warn", message, context as Partial<LogContext>),
      };
      const mapped = mapCompiledToContract(compiled, orgRoles, mapperLogger);

      const { hubAdmin, hubAccess } = await permissionService.getEffectiveHubAccess(userId, orgId);

      let grantedActions = 0;
      let resourcesWithAnyGrant = 0;
      for (const actions of Object.values(mapped.permissions)) {
        const granted = Object.values(actions).filter(Boolean).length;
        grantedActions += granted;
        if (granted > 0) {
          resourcesWithAnyGrant += 1;
        }
      }

      const crewLink = await getCrewLinkForUser(orgId, userId);

      return res.json({
        generatedAt: new Date().toISOString(),
        devBypassActive: isDevBypass,
        session: sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email ?? null,
              name: sessionUser.name ?? null,
              role: sessionUser.role ?? null,
              orgId: authReq.orgId ?? null,
            }
          : null,
        dbUser: dbUser ?? null,
        mismatches: {
          userMissingInDb: !dbUser,
          roleSessionVsDb:
            !!sessionUser && !!dbUser && (sessionUser.role ?? null) !== (dbUser.role ?? null),
        },
        effectiveRole: dbUser?.role ?? sessionUser?.role ?? null,
        primaryRole: dbUser?.role ?? null,
        assignedRoles: mapped.roles,
        hubAdmin,
        hubAccess,
        permissionSummary: { resourcesWithAnyGrant, grantedActions },
        crewLink: crewLink ?? null,
      });
    })
  );
}
