import type { Express, Request, Response } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { insertRoleSchema } from "../../../shared/schema/permissions";
import { auditService } from "../../compliance/immutable-audit.service";
import { validateResponse } from "../../lib/api-helpers";
import { stripUndefined } from "../../lib/strip-undefined";
import { sendCreated, sendDeleted, withErrorHandling } from "../../lib/route-utils";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import { requirePermission } from "./middleware";
import { permissionRepository } from "./repository";
import {
  roleGetResponseSchema,
  roleGrantsResponseSchema,
  roleListResponseSchema,
  roleTemplatesResponseSchema,
} from "./response-schemas";
import { permissionService } from "./service";
import {
  fromTemplateBodySchema,
  idParamSchema,
  requireSuperAdminForPermissions,
} from "./route-shared";

const grantSchema = z.object({
  resourceCode: z.string(),
  actionCode: z.string(),
  isGranted: z.boolean(),
});

export function registerPermissionRoleRoutes(app: Express) {
  app.get(
    "/api/permissions/roles",
    requireOrgId,
    withErrorHandling("list roles", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const roles = await permissionRepository.listRoles(orgId);
      return res.json(
        validateResponse(roleListResponseSchema, roles, "GET /api/permissions/roles")
      );
    })
  );

  app.get(
    "/api/permissions/roles/:id",
    requireOrgId,
    withErrorHandling("get role", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
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
    requireSuperAdminForPermissions,
    withErrorHandling("create role", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const rawBody = jsonRecordSchema.parse(req.body);
      const data = insertRoleSchema.parse({ ...rawBody, orgId });
      const role = await permissionRepository.createRole(data);

      const authReq = authenticatedRequest(req);
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
    requireSuperAdminForPermissions,
    withErrorHandling("update role", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const existing = await permissionRepository.getRoleById(id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      const rawBody = jsonRecordSchema.parse(req.body);
      const { orgId: _, ...bodyWithoutOrgId } = rawBody;
      const data = stripUndefined(insertRoleSchema.partial().parse(bodyWithoutOrgId));
      const updated = await permissionRepository.updateRole(id, orgId, data);

      const authReq = authenticatedRequest(req);
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
    requireSuperAdminForPermissions,
    withErrorHandling("partial update role", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const existing = await permissionRepository.getRoleById(id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot modify system roles" });
      }

      const rawBody = jsonRecordSchema.parse(req.body);
      const { orgId: _, ...bodyWithoutOrgId } = rawBody;
      const data = stripUndefined(insertRoleSchema.partial().parse(bodyWithoutOrgId));
      const updated = await permissionRepository.updateRole(id, orgId, data);

      const authReq = authenticatedRequest(req);
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
    requireSuperAdminForPermissions,
    withErrorHandling("delete role", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
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

      const authReq = authenticatedRequest(req);
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
    requirePermission("permission_management", "view"),
    withErrorHandling("get role permission grants", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const role = await permissionRepository.getRoleById(id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      const grants = await permissionRepository.getPermissionGrantsForRole(id);
      return res.json(
        validateResponse(roleGrantsResponseSchema, grants, "GET /api/permissions/roles/:id/grants")
      );
    })
  );

  app.put(
    "/api/permissions/roles/:id/grants",
    requireOrgId,
    requireSuperAdminForPermissions,
    requirePermission("permission_management", "edit"),
    withErrorHandling("update role permission grants", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { id } = idParamSchema.parse(req.params);
      const role = await permissionRepository.getRoleById(id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      const bodyShape = z
        .union([z.object({ grants: z.array(grantSchema) }), z.array(grantSchema)])
        .parse(req.body);
      const grantsArray = Array.isArray(bodyShape) ? bodyShape : bodyShape.grants;

      const authReq = authenticatedRequest(req);

      const MANAGE_RESOURCE = "permission_management";
      const MANAGE_ACTION = "edit";
      const revokesManage = grantsArray.some(
        (g) =>
          g.resourceCode === MANAGE_RESOURCE &&
          g.actionCode === MANAGE_ACTION &&
          g.isGranted === false
      );
      if (revokesManage) {
        const proposedChange = [...grantsArray]
          .reverse()
          .find((g) => g.resourceCode === MANAGE_RESOURCE && g.actionCode === MANAGE_ACTION);

        const currentManageCache = new Map<string, boolean>();
        const roleManagesNow = async (roleId: string): Promise<boolean> => {
          const cached = currentManageCache.get(roleId);
          if (cached !== undefined) {
            return cached;
          }
          const grants = await permissionRepository.getPermissionGrantsForRole(roleId);
          const value = grants.some(
            (g) =>
              g.resourceCode === MANAGE_RESOURCE &&
              g.actionCode === MANAGE_ACTION &&
              g.isGranted !== false
          );
          currentManageCache.set(roleId, value);
          return value;
        };
        const roleManagesAfter = async (roleId: string): Promise<boolean> => {
          if (roleId === id && proposedChange) {
            return proposedChange.isGranted;
          }
          return roleManagesNow(roleId);
        };

        const orgRoles = await permissionRepository.listRoles(orgId);
        let someoneRetainsManage = false;
        for (const r of orgRoles) {
          if (await roleManagesAfter(r.id)) {
            someoneRetainsManage = true;
            break;
          }
        }
        if (!someoneRetainsManage) {
          return res.status(400).json({
            message:
              "This change would remove the last role that can manage permissions, locking everyone out of access administration. Keep at least one role with Permission Management edit access.",
          });
        }

        const actorId = authReq.user?.id;
        if (actorId) {
          const assignments = await permissionRepository.listUserRoleAssignments(actorId, orgId);
          const actorRoleIds = new Set(assignments.map((a) => a.roleId));
          const primaryRoleName = authReq.user?.role;
          if (primaryRoleName) {
            const primaryRole = orgRoles.find((r) => r.name === primaryRoleName);
            if (primaryRole) {
              actorRoleIds.add(primaryRole.id);
            }
          }

          let actorManagesNow = false;
          for (const roleId of actorRoleIds) {
            if (await roleManagesNow(roleId)) {
              actorManagesNow = true;
              break;
            }
          }
          if (actorManagesNow) {
            let actorManagesAfter = false;
            for (const roleId of actorRoleIds) {
              if (await roleManagesAfter(roleId)) {
                actorManagesAfter = true;
                break;
              }
            }
            if (!actorManagesAfter) {
              return res.status(400).json({
                message:
                  "This change would remove your own ability to manage permissions, locking you out of access administration. Keep Permission Management edit access on one of your roles.",
              });
            }
          }
        }
      }

      const before = await permissionRepository.getPermissionGrantsForRole(id);

      await permissionRepository.bulkSetPermissionGrants(id, grantsArray);

      const after = await permissionRepository.getPermissionGrantsForRole(id);

      const changedFields = grantsArray.map((g) => `${g.resourceCode}:${g.actionCode}`);
      const actorId = authReq.user?.id || "system";

      await permissionRepository.logPermissionChange(
        orgId,
        actorId,
        "update_grants",
        "role",
        id,
        JSON.stringify({ grants: before }),
        JSON.stringify({ grants: after })
      );

      await auditService.logEvent({
        orgId,
        eventCategory: "security_event",
        eventType: "permission_changed",
        entityType: "role",
        entityId: id,
        previousState: { roleName: role.name, grants: before },
        newState: { roleName: role.name, grants: after },
        changedFields,
        performedBy: actorId,
        performedByType: "user",
        performedByName: authReq.user?.name,
        performedByRole: authReq.user?.role,
        complianceStandard: "IMO 2021 Cybersecurity",
        retentionRequired: true,
      });

      permissionService.invalidateOrgPermissionCache(orgId);

      return res.json({
        success: true,
        message: `Updated ${grantsArray.length} permission grants`,
      });
    })
  );

  app.get(
    "/api/permissions/templates",
    requireOrgId,
    withErrorHandling("list role templates", async (_req: Request, res: Response) => {
      const templates = await permissionRepository.listRoleTemplates();
      return res.json(
        validateResponse(roleTemplatesResponseSchema, templates, "GET /api/permissions/templates")
      );
    })
  );

  app.post(
    "/api/permissions/roles/from-template",
    requireOrgId,
    withErrorHandling("create role from template", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { templateId, overrides } = fromTemplateBodySchema.parse(req.body);

      const role = await permissionRepository.createRoleFromTemplate(templateId, orgId, overrides);

      const authReq = authenticatedRequest(req);
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
}
