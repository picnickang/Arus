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
import { CREW_DOCUMENT_TYPE_VALUES } from "@shared/schema";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { requirePermission } from "../../permissions/middleware.js";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

const roleIdParamSchema = z.object({ id: z.string().min(1) });

// Optional per-role defaults. An empty string from the form means "no default"
// and is normalized to null (clears the column); an absent key leaves it
// untouched on update.
const nullableText = (max: number) =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().max(max).nullable().optional()
  );
const nullableNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(min).max(max).nullable().optional()
  );

const roleDefaultsShape = {
  defaultDepartment: nullableText(100),
  defaultMinRestHours: nullableNumber(0, 24),
  defaultMaxHours: nullableNumber(0, 168),
  defaultWatchKeeping: nullableText(100),
  defaultRoleId: nullableText(64),
  // Document types this role requires. Absent = leave untouched; an explicit
  // (possibly empty) array replaces the stored set. Validated against the
  // crew_documents type catalog so only real document types can be required.
  requiredDocuments: z.array(z.enum(CREW_DOCUMENT_TYPE_VALUES)).optional(),
};

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100).default("Other"),
  ...roleDefaultsShape,
});

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    active: z.boolean().optional(),
    ...roleDefaultsShape,
  })
  .refine((v) => Object.keys(v).length > 0, {
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

  // Per-crew document compliance against each crew member's role requirements.
  // Org-scoped read; powers the roster needs-action highlight. Only returns crew
  // with at least one missing or soon-expiring required document.
  app.get(
    "/api/crew-roles/document-compliance",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("crew role document compliance", async (req, res) => {
      const rows = await crewService.getRoleDocumentCompliance(req.orgId);
      res.json(rows);
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
        defaultDepartment: body.defaultDepartment,
        defaultMinRestHours: body.defaultMinRestHours,
        defaultMaxHours: body.defaultMaxHours,
        defaultWatchKeeping: body.defaultWatchKeeping,
        defaultRoleId: body.defaultRoleId,
        requiredDocuments: body.requiredDocuments,
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
