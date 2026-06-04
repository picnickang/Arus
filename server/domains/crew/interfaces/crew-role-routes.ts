/**
 * Crew Routes - Manageable Crew Roles (positions / ranks)
 *
 * Lets authorized users add, rename, reorder, and delete the labelled crew
 * positions (Captain, Chief Officer, Chief Engineer, Bosun, …) that back the
 * `crew.rank` text column and drive roster grouping + the Add/Edit Crew role
 * dropdown. This is the crew POSITION concept — deliberately SEPARATE from the
 * RBAC permission roles served by `/api/roles`. Org-scoped; reads require
 * `crew_members:view` and every mutation requires `crew_members:edit`, the
 * same permission the crew registry UI gates role management on
 * (`canManageCrew = canEdit("crew_members")`) — so the API can't be used to
 * bypass the UI's manage-crew restriction.
 */

import { z } from "zod";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { requirePermission } from "../../permissions/middleware.js";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

const roleIdParamSchema = z.object({ id: z.string().min(1) });

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100).default("Other"),
});

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.category !== undefined || v.active !== undefined, {
    message: "No fields to update",
  });

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export function registerCrewRoleRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew-roles",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("list crew roles", async (req, res) => {
      const roles = await crewService.listCrewRoles(req.orgId);
      res.json(roles);
    })
  );

  app.post(
    "/api/crew-roles",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    withErrorHandling("create crew role", async (req, res) => {
      const body = createRoleSchema.parse(req.body ?? {});
      const role = await crewService.createCrewRole({
        orgId: req.orgId,
        name: body.name,
        category: body.category,
      });
      sendCreated(res, role);
    })
  );

  // NOTE: /reorder is registered before /:id so the literal path is not
  // swallowed by the :id param route.
  app.patch(
    "/api/crew-roles/reorder",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    withErrorHandling("reorder crew roles", async (req, res) => {
      const { orderedIds } = reorderSchema.parse(req.body ?? {});
      const roles = await crewService.reorderCrewRoles(req.orgId, orderedIds);
      res.json(roles);
    })
  );

  app.patch(
    "/api/crew-roles/:id",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update crew role", async (req, res) => {
      const { id } = roleIdParamSchema.parse(req.params);
      const body = updateRoleSchema.parse(req.body ?? {});
      const role = await crewService.updateCrewRole(id, req.orgId, body);
      res.json(role);
    })
  );

  app.delete(
    "/api/crew-roles/:id",
    requireOrgId,
    requirePermission("crew_members", "edit"),
    criticalOperationRateLimit,
    withErrorHandling("delete crew role", async (req, res) => {
      const { id } = roleIdParamSchema.parse(req.params);
      const { role, assignedCount } = await crewService.getCrewRoleUsage(id, req.orgId);
      if (!role) {
        res.status(404).json({ error: "Crew role not found" });
        return;
      }
      if (assignedCount > 0) {
        res.status(409).json({
          error: `Cannot delete "${role.name}" while ${assignedCount} crew member(s) are assigned to it. Reassign them to another role first.`,
          assignedCount,
        });
        return;
      }
      await crewService.deleteCrewRole(id, req.orgId);
      sendDeleted(res);
    })
  );
}
