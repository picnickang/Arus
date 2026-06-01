/**
 * Crew Routes - Crew Members
 * CRUD operations for crew members
 */

import { insertCrewSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { permissionRepository } from "../../permissions/repository.js";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import { requirePermission } from "../../permissions/middleware.js";
import {
  withErrorHandling,
  sendCreated,
  sendDeleted,
  sendNotFound,
} from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

export function registerCrewMemberRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("fetch crew", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { vesselId } = req.query;
      const crew = await crewService.listCrew(orgId, vesselId as string | undefined);
      res.json(crew);
    })
  );

  app.post(
    "/api/crew",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "create"),
    writeOperationRateLimit,
    withErrorHandling("create crew member", async (req, res) => {
      const body = { ...req.body };
      if (typeof body.startDate === "string") {
        body.startDate = body.startDate ? new Date(body.startDate) : undefined;
      }
      if (typeof body.contractEndDate === "string") {
        body.contractEndDate = body.contractEndDate ? new Date(body.contractEndDate) : undefined;
      }
      if (typeof body.terminationDate === "string") {
        body.terminationDate = body.terminationDate ? new Date(body.terminationDate) : undefined;
      }
      const crewData = insertCrewSchema.parse(body);
      const crew = await crewService.createCrew(crewData, req.user?.id);
      sendCreated(res, crew);
    })
  );

  // Get available ranks/roles for crew assignment
  // Sources ranks from the RBAC permissions system
  // Auto-provisions templates into roles table on first access
  // NOTE: This MUST be before /:id routes to match correctly
  app.get(
    "/api/crew/available-ranks",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("fetch available ranks", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      // Get or provision roles from templates - ensures all roles are in the roles table
      const allRoles = await permissionRepository.getOrProvisionRolesForOrg(orgId);

      // Format for crew assignment dropdown
      const availableRanks = allRoles
        .filter((role) => role.isActive)
        .map((role) => ({
          id: role.id,
          name: role.name,
          displayName: role.displayName,
          department: role.department,
          hierarchyLevel: role.hierarchyLevel,
          source: role.templateId ? ("template" as const) : ("custom" as const),
        }))
        .sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);

      res.json(availableRanks);
    })
  );

  app.get(
    "/api/crew/:id",
    requireOrgId,
    requirePermission("crew_members", "view"),
    generalApiRateLimit,
    withErrorHandling("fetch crew member", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const crew = await crewService.getCrewById(req.params['id'] ?? '', orgId);

      if (!crew) {
        sendNotFound(res, "Crew member");
        return;
      }

      res.json(crew);
    })
  );

  app.put(
    "/api/crew/:id",
    requireOrgIdAndValidateBody,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update crew member", async (req, res) => {
      const body = { ...req.body };
      if (typeof body.startDate === "string") {
        body.startDate = body.startDate ? new Date(body.startDate) : undefined;
      }
      if (typeof body.contractEndDate === "string") {
        body.contractEndDate = body.contractEndDate ? new Date(body.contractEndDate) : undefined;
      }
      if (typeof body.terminationDate === "string") {
        body.terminationDate = body.terminationDate ? new Date(body.terminationDate) : undefined;
      }
      const crewData = insertCrewSchema.partial().parse(body);
      const orgId = (req as AuthenticatedRequest).orgId;
      const crew = await crewService.updateCrew(req.params['id'] ?? '', crewData, req.user?.id, orgId);
      res.json(crew);
    })
  );

  app.delete(
    "/api/crew/:id",
    requireOrgId,
    requirePermission("crew_members", "delete"),
    criticalOperationRateLimit,
    withErrorHandling("delete crew member", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await crewService.deleteCrew(req.params['id'] ?? '', req.user?.id, orgId);
      sendDeleted(res);
    })
  );
}
