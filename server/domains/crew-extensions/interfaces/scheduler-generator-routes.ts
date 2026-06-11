import type { Express, Response } from "express";
import {
  applySimulatedSchedule,
  revertGeneratedSchedule,
  simulateSchedule,
} from "../../../scheduler/scheduler-controller.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import type { AuthenticatedRequest, CrewExtensionsRoutesConfig } from "./types.js";
import {
  applyDraftBodySchema,
  runIdParamSchema,
  simulateBodySchema,
} from "./scheduler-route-schemas.js";

export function registerSchedulerGeneratorRoutes(
  app: Express,
  config: CrewExtensionsRoutesConfig
): void {
  const { crewOperationRateLimit } = config;

  app.post(
    "/api/schedule/simulate",
    crewOperationRateLimit,
    withErrorHandling("simulate schedule", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { from, days, vessels, fillUnassignedOnly } = simulateBodySchema.parse(req.body ?? {});
      const result = await simulateSchedule({
        orgId,
        from,
        days: days || 7,
        vessels,
        fillUnassignedOnly: fillUnassignedOnly !== false,
      });
      return res.json(result);
    })
  );

  app.post(
    "/api/schedule/apply-draft",
    crewOperationRateLimit,
    withErrorHandling(
      "apply simulated schedule",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { simulationResult, skipCollisions, vesselIds } = applyDraftBodySchema.parse(
          req.body ?? {}
        );

        if (!simulationResult || !simulationResult.proposed) {
          return res
            .status(400)
            .json({ error: "simulationResult with proposed assignments is required" });
        }

        const result = await applySimulatedSchedule({
          orgId,
          simulationResult,
          skipCollisions: skipCollisions !== false,
          vesselIds: vesselIds && Array.isArray(vesselIds) ? vesselIds : undefined,
        });
        return res.json(result);
      }
    )
  );

  app.post(
    "/api/schedule/revert/:runId",
    crewOperationRateLimit,
    withErrorHandling(
      "revert generated schedule",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { runId } = runIdParamSchema.parse(req.params);

        if (!runId) {
          return res.status(400).json({ error: "runId is required" });
        }

        const result = await revertGeneratedSchedule({ orgId, runId });
        return res.json(result);
      }
    )
  );
}
