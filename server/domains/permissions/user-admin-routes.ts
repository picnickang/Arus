import type { Express, Request, Response } from "express";
import { jsonRecordSchema } from "@shared/validation/json";
import { insertUserRoleAssignmentSchema } from "../../../shared/schema/permissions";
import { validateResponse } from "../../lib/api-helpers";
import { sendCreated, sendDeleted, withErrorHandling } from "../../lib/route-utils";
import { authenticatedRequest, requireOrgId } from "../../middleware/auth";
import { requirePermission } from "./middleware";
import { permissionRepository } from "./repository";
import {
  permissionAuditResponseSchema,
  userRoleAssignmentsResponseSchema,
  usersWithRolesResponseSchema,
} from "./response-schemas";
import { permissionService } from "./service";
import { auditQuerySchema, userIdParamSchema, userIdRoleIdParamSchema } from "./route-shared";

export function registerPermissionUserAdminRoutes(app: Express) {
  app.get(
    "/api/permissions/users/:userId/assignments",
    requireOrgId,
    withErrorHandling("list user role assignments", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { userId } = userIdParamSchema.parse(req.params);
      const assignments = await permissionRepository.listUserRoleAssignments(userId, orgId);
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
      const orgId = authenticatedRequest(req).orgId;
      const authReq = authenticatedRequest(req);
      const { userId } = userIdParamSchema.parse(req.params);
      const rawBody = jsonRecordSchema.parse(req.body);

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
      const orgId = authenticatedRequest(req).orgId;
      const authReq = authenticatedRequest(req);
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
      const orgId = authenticatedRequest(req).orgId;
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
    requirePermission("permission_management", "view"),
    withErrorHandling("get permission audit log", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { limit } = auditQuerySchema.parse(req.query);
      const auditLog = await permissionRepository.getPermissionAuditLog(orgId, limit);
      return res.json(
        validateResponse(permissionAuditResponseSchema, auditLog, "GET /api/permissions/audit")
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
      const orgId = authenticatedRequest(req).orgId;
      const authReq = authenticatedRequest(req);

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
