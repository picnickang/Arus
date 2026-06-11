/**
 * Permission Routes - API Endpoints for Permission Management
 *
 * CRUD operations for roles, permissions, and user assignments.
 */

import type { Express, Request, Response } from "express";
import {
  permissionRepository,
  getUserPrimaryRole,
} from "./repository";
import { permissionService, compileUserPermissions } from "./service";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import { withErrorHandling } from "../../lib/route-utils";
import { validateResponse } from "../../lib/api-helpers";
import {
  permissionsMeResponseSchema,
  permissionResourcesResponseSchema,
  permissionActionsResponseSchema,
  permissionRegistryResponseSchema,
} from "./response-schemas";
import { mapCompiledToContract, type MapperLogger } from "./mapper";
import { structuredLog, type LogContext } from "../../logging";
import { RESOURCES, ACTIONS, RESOURCE_CATEGORIES } from "../../config/permission-registry";
import { isDevAuthBypassEnabled, isDevBypassUser } from "../../security/dev-auth";
import { devUserRoleLabel, getDevLoginUserRole } from "../../security/dev-login";
import { registerPermissionDevDiagnosticRoute } from "./dev-diagnostic-route";
import { registerPermissionRoleRoutes } from "./role-routes";
import { DEV_ORG_ID, DEV_USER_ID } from "./route-shared";
import { registerPermissionUserAdminRoutes } from "./user-admin-routes";

export function registerPermissionRoutes(app: Express) {
  app.get(
    "/api/permissions/me",
    requireOrgId,
    withErrorHandling("get current user permissions", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const realUserId = authReq.user?.id;
      const orgId = authReq.orgId || DEV_ORG_ID;

      const devUserRole = getDevLoginUserRole(realUserId);
      if (isDevAuthBypassEnabled() && devUserRole) {
        return res.json(
          validateResponse(
            permissionsMeResponseSchema,
            {
              userId: realUserId,
              orgId,
              roles: [
                {
                  id: `dev-user-role:${devUserRole}`,
                  name: devUserRole,
                  displayName: `${devUserRoleLabel(devUserRole)} (Dev Preview)`,
                },
              ],
              permissions: {},
              isDevMode: false,
              hubAdmin: false,
              hubAccess: [],
            },
            "GET /api/permissions/me (dev user preview)"
          )
        );
      }

      // Temporary dev-login admin sessions resolve to the synthetic superuser id
      // and intentionally receive all permissions. Regular dev-user previews
      // are handled above and never inherit this blanket grant.
      if (isDevAuthBypassEnabled() && isDevBypassUser(realUserId)) {
        const allPermissions: Record<string, Record<string, boolean>> = {};
        for (const resource of RESOURCES) {
          allPermissions[resource.code] = {};
          for (const action of resource.actions) {
            allPermissions[resource.code]![action] = true;
          }
        }
        return res.json(
          validateResponse(
            permissionsMeResponseSchema,
            {
              userId: realUserId ?? DEV_USER_ID,
              orgId,
              roles: [
                { id: "dev-role", name: "super_admin", displayName: "Super Admin (Dev Mode)" },
              ],
              permissions: allPermissions,
              isDevMode: true,
              hubAdmin: true,
              hubAccess: null,
            },
            "GET /api/permissions/me (dev)"
          )
        );
      }

      const userId = realUserId || DEV_USER_ID;
      const compiled = await compileUserPermissions(userId, orgId);
      const orgRoles = await permissionRepository.listRoles(orgId);
      const mapperLogger: MapperLogger = {
        warn: (message, context) => structuredLog("warn", message, context as Partial<LogContext>),
      };
      const mapped = mapCompiledToContract(compiled, orgRoles, mapperLogger);

      // Hub access is resolved in the permissions service from the user's
      // role(s) + any explicit per-user grant (see getEffectiveHubAccess). The
      // primary-role column is still read here for the role-merge below.
      const userRow = await getUserPrimaryRole(orgId, userId);
      const { hubAdmin, hubAccess } = await permissionService.getEffectiveHubAccess(userId, orgId);

      // The user's PRIMARY role (`users.role`) is what server-side route
      // guards authorize against (`requireRole(...)` checks `user.role`
      // only — never the assignment-derived roles). `mapped.roles` is
      // built purely from `user_role_assignments`, so a top admin whose
      // authority comes from the primary column with no matching
      // assignment row was returned an empty/partial `roles` list. The
      // client then hid admin-only surfaces (e.g. the crew Access & Login
      // tab) even though the backend would authorize the same user. Merge
      // the primary role into the contract `roles` so the client role-name
      // gate stays in lockstep with `requireRole`.
      const rolesWithPrimary = [...mapped.roles];
      const primaryRoleName = userRow?.role;
      if (primaryRoleName) {
        const normalizedPrimary = primaryRoleName.toLowerCase();
        const alreadyPresent = rolesWithPrimary.some(
          (r) => r.name.toLowerCase() === normalizedPrimary
        );
        if (!alreadyPresent) {
          const fromOrg = orgRoles.find((r) => r.name.toLowerCase() === normalizedPrimary);
          rolesWithPrimary.unshift(
            fromOrg
              ? { id: fromOrg.id, name: fromOrg.name, displayName: fromOrg.displayName }
              : {
                  id: `primary:${primaryRoleName}`,
                  name: primaryRoleName,
                  displayName: primaryRoleName,
                }
          );
        }
      }

      return res.json(
        validateResponse(
          permissionsMeResponseSchema,
          { ...mapped, roles: rolesWithPrimary, isDevMode: false, hubAdmin, hubAccess },
          "GET /api/permissions/me"
        )
      );
    })
  );

  app.get(
    "/api/permissions/resources",
    requireOrgId,
    withErrorHandling("list permission resources", async (_req: Request, res: Response) => {
      const resources = await permissionRepository.listResources();
      return res.json(
        validateResponse(
          permissionResourcesResponseSchema,
          resources,
          "GET /api/permissions/resources"
        )
      );
    })
  );

  app.get(
    "/api/permissions/actions",
    requireOrgId,
    withErrorHandling("list permission actions", async (_req: Request, res: Response) => {
      const actions = await permissionRepository.listActions();
      return res.json(
        validateResponse(permissionActionsResponseSchema, actions, "GET /api/permissions/actions")
      );
    })
  );

  app.get(
    "/api/permissions/registry",
    requireOrgId,
    withErrorHandling("get permission registry", async (_req: Request, res: Response) => {
      return res.json(
        validateResponse(
          permissionRegistryResponseSchema,
          {
            resources: RESOURCES,
            actions: Object.values(ACTIONS),
            categories: RESOURCE_CATEGORIES,
          },
          "GET /api/permissions/registry"
        )
      );
    })
  );

  registerPermissionRoleRoutes(app);
  registerPermissionUserAdminRoutes(app);
  registerPermissionDevDiagnosticRoute(app);
}
