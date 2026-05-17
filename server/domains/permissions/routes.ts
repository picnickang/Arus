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
import {
  insertRoleSchema,
  insertUserRoleAssignmentSchema,
} from "../../../shared/schema/permissions";
import { RESOURCES, ACTIONS, RESOURCE_CATEGORIES } from "../../config/permission-registry";
import { z } from "zod";

const DEV_MODE = process.env.NODE_ENV === "development";
const DEV_ORG_ID = "default-org-id";
const DEV_USER_ID = "dev-user-id";

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
            allPermissions[resource.code][action] = true;
          }
        }
        return res.json(
          validateResponse(
            permissionsMeResponseSchema,
            {
              userId: DEV_USER_ID,
              orgId: DEV_ORG_ID,
              roles: [{ id: "dev-role", name: "developer", displayName: "Developer (Dev Mode)" }],
              permissions: allPermissions,
              isDevMode: true,
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

      res.json(
        validateResponse(
          permissionsMeResponseSchema,
          { ...mapped, isDevMode: false },
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
      res.json(
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
      res.json(
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
      res.json(
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
      res.json(validateResponse(roleListResponseSchema, roles, "GET /api/permissions/roles"));
    })
  );

  app.get(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("get role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const role = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(
        validateResponse(roleGetResponseSchema, role, "GET /api/permissions/roles/:id")
      );
    })
  );

  app.post(
    "/api/permissions/roles",
    requireOrgId,
    withErrorHandling("create role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = insertRoleSchema.parse({ ...req.body, orgId });
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
      const existing = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      // Security: Strip orgId from body to prevent cross-tenant mutation
      const { orgId: _, ...bodyWithoutOrgId } = req.body;
      const data = insertRoleSchema.partial().parse(bodyWithoutOrgId);
      const updated = await permissionRepository.updateRole(req.params.id, orgId, data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_role",
        "role",
        req.params.id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      res.json(updated);
    })
  );

  app.patch(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("partial update role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot modify system roles" });
      }

      // Security: Strip orgId from body to prevent cross-tenant mutation
      const { orgId: _, ...bodyWithoutOrgId } = req.body;
      const data = insertRoleSchema.partial().parse(bodyWithoutOrgId);
      const updated = await permissionRepository.updateRole(req.params.id, orgId, data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_role",
        "role",
        req.params.id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      res.json(updated);
    })
  );

  app.delete(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("delete role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot delete system roles" });
      }

      // Check if any crew members are assigned to this role
      const crewWithRole = await permissionRepository.getCrewCountByRoleId(req.params.id, orgId);
      if (crewWithRole > 0) {
        return res.status(400).json({
          message: `Cannot delete role: ${crewWithRole} crew member(s) are currently assigned to this role. Please reassign them first.`,
          crewCount: crewWithRole,
        });
      }

      await permissionRepository.deleteRole(req.params.id, orgId);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "delete_role",
        "role",
        req.params.id,
        JSON.stringify(existing),
        null
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      sendDeleted(res);
    })
  );

  app.get(
    "/api/permissions/roles/:id/grants",
    requireOrgId,
    withErrorHandling("get role permission grants", async (req: Request, res: Response) => {
      const grants = await permissionRepository.getPermissionGrantsForRole(req.params.id);
      res.json(
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
      const role = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      const grantsArray = z.array(grantSchema).parse(req.body.grants || req.body);

      await permissionRepository.bulkSetPermissionGrants(req.params.id, grantsArray);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_grants",
        "role",
        req.params.id,
        null,
        JSON.stringify({ grants: grantsArray.length })
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      res.json({ success: true, message: `Updated ${grantsArray.length} permission grants` });
    })
  );

  app.get(
    "/api/permissions/templates",
    requireOrgId,
    withErrorHandling("list role templates", async (_req: Request, res: Response) => {
      const templates = await permissionRepository.listRoleTemplates();
      res.json(
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
      const { templateId, overrides } = req.body;

      if (!templateId) {
        return res.status(400).json({ message: "templateId is required" });
      }

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
      const assignments = await permissionRepository.listUserRoleAssignments(
        req.params.userId,
        orgId
      );
      res.json(
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

      const data = insertUserRoleAssignmentSchema.parse({
        ...req.body,
        orgId,
        userId: req.params.userId,
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
        JSON.stringify({ userId: req.params.userId, roleId: data.roleId })
      );

      permissionService.invalidateUserPermissionCache(req.params.userId, orgId);

      sendCreated(res, assignment);
    })
  );

  app.delete(
    "/api/permissions/users/:userId/assignments/:roleId",
    requireOrgId,
    withErrorHandling("remove role from user", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;

      await permissionRepository.removeRoleFromUser(req.params.userId, req.params.roleId, orgId);

      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "remove_role",
        "user_role_assignment",
        null,
        JSON.stringify({ userId: req.params.userId, roleId: req.params.roleId }),
        null
      );

      permissionService.invalidateUserPermissionCache(req.params.userId, orgId);

      sendDeleted(res);
    })
  );

  app.get(
    "/api/permissions/users-with-roles",
    requireOrgId,
    withErrorHandling("list users with role assignments", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const usersWithRoles = await permissionRepository.listUsersWithRoles(orgId);
      res.json(
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
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const auditLog = await permissionRepository.getPermissionAuditLog(orgId, limit);
      res.json(
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
      res.json({ success: true, message: "Permission resources seeded" });
    })
  );

  app.post(
    "/api/permissions/seed-templates",
    requireOrgId,
    withErrorHandling("seed default role templates", async (_req: Request, res: Response) => {
      const result = await permissionRepository.seedDefaultRoleTemplates();
      res.json({
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

      res.json({
        success: true,
        message: "Permission system initialized",
        templates: templatesResult,
      });
    })
  );
}
