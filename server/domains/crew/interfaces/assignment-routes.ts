/**
 * Crew Routes - Assignments
 * Crew assignment operations
 */

import { insertCrewAssignmentSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { CrewRouteDeps } from "./types.js";

export function registerAssignmentRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew-assignments",
    generalApiRateLimit,
    withErrorHandling("fetch crew assignments", async (req, res) => {
      const { date, crewId, vesselId } = req.query;
      const assignments = await crewService.listAssignments(
        date as string | undefined,
        crewId as string | undefined,
        vesselId as string | undefined
      );
      res.json(assignments);
    })
  );

  app.post(
    "/api/crew-assignments",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create crew assignment", async (req, res) => {
      const assignmentData = insertCrewAssignmentSchema.parse(req.body);
      const assignment = await crewService.createAssignment(assignmentData, req.user?.id);
      sendCreated(res, assignment);
    })
  );

  app.put(
    "/api/crew-assignments/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update crew assignment", async (req, res) => {
      const assignmentData = insertCrewAssignmentSchema.partial().parse(req.body);
      const assignment = await crewService.updateAssignment(
        req.params.id,
        assignmentData,
        req.user?.id
      );
      res.json(assignment);
    })
  );

  app.delete(
    "/api/crew-assignments/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete crew assignment", async (req, res) => {
      await crewService.deleteAssignment(req.params.id, req.user?.id);
      sendDeleted(res);
    })
  );
}
