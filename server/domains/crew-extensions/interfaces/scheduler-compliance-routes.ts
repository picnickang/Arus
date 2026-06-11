import type { Express, Response } from "express";
import { createLogger } from "../../../lib/structured-logger";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { canAssignCrew } from "../../../services/hor-projector/constraint-checker.js";
import { projectComplianceFromAssignments } from "../../../services/hor-projector/projector.js";
import type { AuthenticatedRequest, CrewExtensionsRoutesConfig } from "./types.js";
import { canAssignSchema, projectComplianceSchema } from "./scheduler-route-schemas.js";

const logger = createLogger("Domains:CrewExtensions:Interfaces:SchedulerRoutes");

export function registerSchedulerComplianceRoutes(
  app: Express,
  config: CrewExtensionsRoutesConfig
): void {
  const { crewOperationRateLimit } = config;

  app.post(
    "/api/crew-extensions/scheduler/can-assign",
    crewOperationRateLimit,
    withErrorHandling(
      "check assignment compliance",
      async (req: AuthenticatedRequest, res: Response) => {
        const validated = canAssignSchema.safeParse(req.body);

        if (!validated.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: validated.error.issues,
          });
        }

        const { crewId, proposedAssignment, existingDrafts } = validated.data;

        try {
          const result = await canAssignCrew(crewId, proposedAssignment, existingDrafts);
          return res.json(result);
        } catch (error) {
          logger.error("Failed to check assignment compliance:", undefined, error);
          return res.json({
            canAssign: true,
            violations: [],
            projectedRestHours: 24,
            projectedWeeklyWork: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/project-compliance",
    crewOperationRateLimit,
    withErrorHandling(
      "project bulk compliance",
      async (req: AuthenticatedRequest, res: Response) => {
        const validated = projectComplianceSchema.safeParse(req.body);

        if (!validated.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: validated.error.issues,
          });
        }

        const { assignments } = validated.data;

        if (assignments.length === 0) {
          return res.json({
            isCompliant: true,
            violations: [],
            summary: {
              totalCrew: 0,
              compliantCrew: 0,
              warningCount: 0,
              errorCount: 0,
            },
          });
        }

        try {
          const result = projectComplianceFromAssignments(assignments);
          return res.json({
            isCompliant: result.isCompliant,
            violations: result.violations,
            summary: result.summary,
          });
        } catch (error) {
          logger.error("Failed to project bulk compliance:", undefined, error);
          return res.json({
            isCompliant: true,
            violations: [],
            summary: {
              totalCrew: 0,
              compliantCrew: 0,
              warningCount: 0,
              errorCount: 0,
            },
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    )
  );
}
