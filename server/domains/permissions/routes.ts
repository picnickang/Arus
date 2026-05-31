/**
 * Permission Routes - API Endpoints for Permission Management
 *
 * CRUD operations for roles, permissions, and user assignments.
 */

import type { Express, Request, Response } from "express";
import { permissionRepository } from "./repository";
import { permissionService, compileUserPermissions } from "./service";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../lib/route-utils";
import { stripUndefined } from "../../lib/strip-undefined";
import { validateResponse } from "../../lib/api-helpers";
import {
  permissionsMeResponseSchema,
  permissionResourcesResponseSchema,
  permissionActionsResponseSchema,
  permissionRegistryResponseSchema,
  roleListResponseSchema,
  roleGetResponseSchema,
  roleGrantsResponseSchema,
  roleTemplatesResponseSchema,
  usersWithRolesResponseSchema,
  permissionAuditResponseSchema,
  userRoleAssignmentsResponseSchema,
} from "./response-schemas";
import { mapCompiledToContract, type MapperLogger } from "./mapper";
import { structuredLog, type LogContext } from "../../logging";
import { db } from "../../db";
import { users } from "@shared/schema";
import { resolveHubAdmin, resolveHubAccess } from "@shared/role-dashboard";
import { and, eq } from "drizzle-orm";
import {
  insertRoleSchema,
  insertUserRoleAssignmentSchema,
} from "../../../shared/schema/permissions";
import { RESOURCES, ACTIONS, RESOURCE_CATEGORIES } from "../../config/permission-registry";
import { z } from "zod";

const DEV_MODE = process.env['NODE_ENV'] === "development";
const DEV_ORG_ID = "default-org-id";
const DEV_USER_ID = "dev-user-id";

const idParamSchema = z.object({ id: z.string().min(1) });
const userIdParamSchema = z.object({ userId: z.string().min(1) });
const userIdRoleIdParamSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
});
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
const fromTemplateBodySchema = z.object({
  templateId: z.string().min(1),
  overrides: z.record(z.unknown()).optional(),
});

export function registerPermissionRoutes(app: Express) {
  app.get(
    "/api/permissions/me",
    requireOrgId,
    withErrorHandling("get current user permissions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || DEV_ORG_ID;
      const userId = (req as AuthenticatedRequest).user?.id || DEV_USER_ID;

      if (DEV_MODE) {
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
              userId: DEV_USER_ID,
              orgId: DEV_ORG_ID,
              // The dev auth bypass authenticates as the admin identity
              // (dev-admin-user) and this branch grants every permission, so the
              // reported role must be an admin-portal role too. Returning a
              // non-admin name like "developer" passes permission-based gates but
              // FAILS role-name gates (e.g. CrewManagement's admin tabs, the
              // getPortalForRole navigation pivot), hiding admin surfaces in dev.
              // Tradeoff: dev always resolves to admin, so exercising the reduced
              // user-portal experience in dev needs a separate mechanism.
              roles: [{ id: "dev-role", name: "system_admin", displayName: "System Admin (Dev Mode)" }],
              permissions: allPermissions,
              isDevMode: true,
              hubAdmin: true,
              hubAccess: null,
            },
            "GET /api/permissions/me (dev)"
          )
        );
      }

      const compiled = await compileUserPermissions(userId, orgId);
      const orgRoles = await permissionRepository.listRoles(orgId);
      const mapperLogger: MapperLogger = {
        warn: (message, context) => structuredLog("warn", message, context as Partial<LogContext>),
      };
      const mapped = mapCompiledToContract(compiled, orgRoles, mapperLogger);

      // Hub access lives on the user row (explicit grant) + the user's role
      // names (super-admins are always-on). Read the columns and resolve.
      const [userRow] = await db
        .select({
          role: users.role,
          hubAdmin: users.hubAdmin,
          hubAccess: users.hubAccess,
        })
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
        .limit(1);
      const roleNames = [
        ...(userRow ? [userRow.role] : []),
        ...mapped.roles.map((r) => r.name),
      ];
      const hubAdmin = resolveHubAdmin(roleNames, userRow?.hubAdmin ?? false);
      const hubAccess = resolveHubAccess(roleNames, userRow?.hubAccess ?? null);

      return res.json(
        validateResponse(
          permissionsMeResponseSchema,
          { ...mapped, isDevMode: false, hubAdmin, hubAccess },
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
        validateResponse(
          permissionActionsResponseSchema,
          actions,
          "GET /api/permissions/actions"
        )
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
            actions: ACTIONS,
            categories: RESOURCE_CATEGORIES,
          },
          "GET /api/permissions/registry"
        )
      );
    })
  );

  app.get(
    "/api/permissions/roles",
    requireOrgId,
    withErrorHandling("list roles", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const roles = await permissionRepository.listRoles(orgId);
      return res.json(validateResponse(roleListResponseSchema, roles, "GET /api/permissions/roles"));
    })
  );

  app.get(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("get role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const role = await permissionRepository.getRoleById(id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      return res.json(
        validateResponse(roleGetResponseSchema, role, "GET /api/permissions/roles/:id")
      );
    })
  );

  app.post(
    "/api/permissions/roles",
    requireOrgId,
    withErrorHandling("create role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const rawBody = z.record(z.unknown()).parse(req.body);
      const data = insertRoleSchema.parse({ ...rawBody, orgId });
      const role = await permissionRepository.createRole(data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "create_role",
        "role",
        role.id,
        null,
        JSON.stringify({ name: role.name, displayName: role.displayName })
      );

      sendCreated(res, role);
    })
  );

  app.put(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("update role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const existing = await permissionRepository.getRoleById(id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      // Security: Strip orgId from body to prevent cross-tenant mutation
      const rawBody = z.record(z.unknown()).parse(req.body);
      const { orgId: _, ...bodyWithoutOrgId } = rawBody;
      const data = stripUndefined(insertRoleSchema.partial().parse(bodyWithoutOrgId));
      const updated = await permissionRepository.updateRole(id, orgId, data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_role",
        "role",
        id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      return res.json(updated);
    })
  );

  app.patch(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("partial update role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const existing = await permissionRepository.getRoleById(id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot modify system roles" });
      }

      // Security: Strip orgId from body to prevent cross-tenant mutation
      const rawBody = z.record(z.unknown()).parse(req.body);
      const { orgId: _, ...bodyWithoutOrgId } = rawBody;
      const data = stripUndefined(insertRoleSchema.partial().parse(bodyWithoutOrgId));
      const updated = await permissionRepository.updateRole(id, orgId, data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_role",
        "role",
        id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      return res.json(updated);
    })
  );

  app.delete(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("delete role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const existing = await permissionRepository.getRoleById(id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot delete system roles" });
      }

      const crewWithRole = await permissionRepository.getCrewCountByRoleId(id, orgId);
      if (crewWithRole > 0) {
        return res.status(400).json({
          message: `Cannot delete role: ${crewWithRole} crew member(s) are currently assigned to this role. Please reassign them first.`,
          crewCount: crewWithRole,
        });
      }

      await permissionRepository.deleteRole(id, orgId);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "delete_role",
        "role",
        id,
        JSON.stringify(existing),
        null
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      sendDeleted(res);
      return undefined;
    })
  );

  app.get(
    "/api/permissions/roles/:id/grants",
    requireOrgId,
    withErrorHandling("get role permission grants", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const grants = await permissionRepository.getPermissionGrantsForRole(id);
      return res.json(
        validateResponse(
          roleGrantsResponseSchema,
          grants,
          "GET /api/permissions/roles/:id/grants"
        )
      );
    })
  );

  const grantSchema = z.object({
    resourceCode: z.string(),
    actionCode: z.string(),
    isGranted: z.boolean(),
  });

  app.put(
    "/api/permissions/roles/:id/grants",
    requireOrgId,
    withErrorHandling("update role permission grants", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { id } = idParamSchema.parse(req.params);
      const role = await permissionRepository.getRoleById(id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      const bodyShape = z
        .union([
          z.object({ grants: z.array(grantSchema) }),
          z.array(grantSchema),
        ])
        .parse(req.body);
      const grantsArray = Array.isArray(bodyShape) ? bodyShape : bodyShape.grants;

      await permissionRepository.bulkSetPermissionGrants(id, grantsArray);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_grants",
        "role",
        id,
        null,
        JSON.stringify({ grants: grantsArray.length })
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      return res.json({ success: true, message: `Updated ${grantsArray.length} permission grants` });
    })
  );

  app.get(
    "/api/permissions/templates",
    requireOrgId,
    withErrorHandling("list role templates", async (_req: Request, res: Response) => {
      const templates = await permissionRepository.listRoleTemplates();
      return res.json(
        validateResponse(
          roleTemplatesResponseSchema,
          templates,
          "GET /api/permissions/templates"
        )
      );
    })
  );

  app.post(
    "/api/permissions/roles/from-template",
    requireOrgId,
    withErrorHandling("create role from template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { templateId, overrides } = fromTemplateBodySchema.parse(req.body);

      const role = await permissionRepository.createRoleFromTemplate(templateId, orgId, overrides);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "create_role_from_template",
        "role",
        role.id,
        null,
        JSON.stringify({ templateId, name: role.name })
      );

      sendCreated(res, role);
    })
  );

  app.get(
    "/api/permissions/users/:userId/assignments",
    requireOrgId,
    withErrorHandling("list user role assignments", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { userId } = userIdParamSchema.parse(req.params);
      const assignments = await permissionRepository.listUserRoleAssignments(
        userId,
        orgId
      );
      return res.json(
        validateResponse(
          userRoleAssignmentsResponseSchema,
          assignments,
          "GET /api/permissions/users/:userId/assignments"
        )
      );
    })
  );

  app.post(
    "/api/permissions/users/:userId/assignments",
    requireOrgId,
    withErrorHandling("assign role to user", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;
      const { userId } = userIdParamSchema.parse(req.params);
      const rawBody = z.record(z.unknown()).parse(req.body);

      const data = insertUserRoleAssignmentSchema.parse({
        ...rawBody,
        orgId,
        userId,
        assignedBy: authReq.user?.id,
      });

      const assignment = await permissionRepository.assignRoleToUser(data);

      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "assign_role",
        "user_role_assignment",
        assignment.id,
        null,
        JSON.stringify({ userId, roleId: data.roleId })
      );

      permissionService.invalidateUserPermissionCache(userId, orgId);

      sendCreated(res, assignment);
    })
  );

  app.delete(
    "/api/permissions/users/:userId/assignments/:roleId",
    requireOrgId,
    withErrorHandling("remove role from user", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;
      const { userId, roleId } = userIdRoleIdParamSchema.parse(req.params);

      await permissionRepository.removeRoleFromUser(userId, roleId, orgId);

      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "remove_role",
        "user_role_assignment",
        null,
        JSON.stringify({ userId, roleId }),
        null
      );

      permissionService.invalidateUserPermissionCache(userId, orgId);

      sendDeleted(res);
    })
  );

  app.get(
    "/api/permissions/users-with-roles",
    requireOrgId,
    withErrorHandling("list users with role assignments", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const usersWithRoles = await permissionRepository.listUsersWithRoles(orgId);
      return res.json(
        validateResponse(
          usersWithRolesResponseSchema,
          usersWithRoles,
          "GET /api/permissions/users-with-roles"
        )
      );
    })
  );

  app.get(
    "/api/permissions/audit",
    requireOrgId,
    withErrorHandling("get permission audit log", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { limit } = auditQuerySchema.parse(req.query);
      const auditLog = await permissionRepository.getPermissionAuditLog(orgId, limit);
      return res.json(
        validateResponse(
          permissionAuditResponseSchema,
          auditLog,
          "GET /api/permissions/audit"
        )
      );
    })
  );

  app.post(
    "/api/permissions/seed",
    requireOrgId,
    withErrorHandling("seed permission resources", async (_req: Request, res: Response) => {
      await permissionRepository.seedResourcesAndActions();
      return res.json({ success: true, message: "Permission resources seeded" });
    })
  );

  app.post(
    "/api/permissions/seed-templates",
    requireOrgId,
    withErrorHandling("seed default role templates", async (_req: Request, res: Response) => {
      const result = await permissionRepository.seedDefaultRoleTemplates();
      return res.json({
        success: true,
        message: `Role templates seeded: ${result.created} created, ${result.skipped} skipped`,
        ...result,
      });
    })
  );

  app.post(
    "/api/permissions/setup",
    requireOrgId,
    withErrorHandling("initial permission setup", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;

      await permissionRepository.seedResourcesAndActions();
      const templatesResult = await permissionRepository.seedDefaultRoleTemplates();

      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "initial_setup",
        "system",
        null,
        null,
        JSON.stringify({ templatesCreated: templatesResult.created })
      );

      return res.json({
        success: true,
        message: "Permission system initialized",
        templates: templatesResult,
      });
    })
  );
}
