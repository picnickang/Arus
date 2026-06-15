import type { Express, Response } from "express";
import { sendBadRequest } from "../../../lib/api-helpers.js";
import { sendNotFound, withErrorHandling } from "../../../lib/route-utils.js";
import { dbSchedulerStorage } from "../../../db/scheduler/index.js";
import { previewScheduleCompliance } from "../../../scheduler/compliance-preview.js";
import { generateHoRFromSchedule } from "../../../scheduler/hor-generator.js";
import {
  applySchedule,
  cancelScheduleRun,
  clearSchedulerRunHistory,
  planAndMaybeExecute,
} from "../../../scheduler/scheduler-controller.js";
import type { AuthenticatedRequest, CrewExtensionsRoutesConfig } from "./types.js";
import {
  idParamSchema,
  planBodySchema,
  previewComplianceBodySchema,
  runsQuerySchema,
} from "./scheduler-route-schemas.js";

export function registerSchedulerRunRoutes(app: Express, config: CrewExtensionsRoutesConfig): void {
  const { crewOperationRateLimit } = config;

  app.post(
    "/api/schedule/plan",
    crewOperationRateLimit,
    withErrorHandling("plan schedule", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { from, days, vessels, mode } = planBodySchema.parse(req.body ?? {});
      const result = await planAndMaybeExecute({
        orgId,
        from,
        days: days || 7,
        vessels,
        mode: mode || "dry_run",
      });
      return res.json(result);
    })
  );

  app.get(
    "/api/schedule/runs",
    withErrorHandling("fetch scheduler runs", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { limit } = runsQuerySchema.parse(req.query);
      const runs = await dbSchedulerStorage.getSchedulerRuns(
        orgId,
        undefined,
        limit ? Number.parseInt(limit) : 50
      );
      const transformed = runs.map((run) => {
        const bag = run as Record<string, unknown>;
        const completedAt = bag["completedAt"] as string | Date | null | undefined;
        return {
          id: run.id,
          orgId: run.orgId,
          status: run.status,
          fromDate: run.startDate ? new Date(run.startDate).toISOString() : null,
          toDate: run.endDate ? new Date(run.endDate).toISOString() : null,
          createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : null,
          appliedAt: completedAt ? new Date(completedAt).toISOString() : null,
          generatedByRunId: (bag["generatedByRunId"] as string | null | undefined) ?? null,
          stats: {
            proposed: (bag["totalAssignments"] as number | undefined) ?? 0,
            unfilled: (bag["unfilledCount"] as number | undefined) ?? 0,
            collisions: 0,
          },
        };
      });
      return res.json(transformed);
    })
  );

  app.get(
    "/api/schedule/runs/:id",
    withErrorHandling("fetch scheduler run", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = idParamSchema.parse(req.params);
      const run = await dbSchedulerStorage.getSchedulerRun(id);
      if (!run || run.orgId !== orgId) {
        return sendNotFound(res, "Scheduler run");
      }
      const assignments = await dbSchedulerStorage.getScheduleAssignmentsByRun(id);
      return res.json({ ...run, assignments });
    })
  );

  app.post(
    "/api/schedule/runs/:id/apply",
    crewOperationRateLimit,
    withErrorHandling("apply scheduler run", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = idParamSchema.parse(req.params);
      const result = await applySchedule(id, orgId);
      return res.json(result);
    })
  );

  app.post(
    "/api/schedule/runs/:id/cancel",
    crewOperationRateLimit,
    withErrorHandling("cancel scheduler run", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { id } = idParamSchema.parse(req.params);
      const result = await cancelScheduleRun(id, orgId);
      return res.json(result);
    })
  );

  app.delete(
    "/api/schedule/runs",
    crewOperationRateLimit,
    withErrorHandling(
      "clear scheduler run history",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const result = await clearSchedulerRunHistory(orgId);
        return res.json(result);
      }
    )
  );

  app.post(
    "/api/schedule/preview-compliance",
    crewOperationRateLimit,
    withErrorHandling("preview compliance", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const { scheduleRunId, assignments: draftAssignments } = previewComplianceBodySchema.parse(
        req.body ?? {}
      );
      let assignments: Awaited<ReturnType<typeof dbSchedulerStorage.getScheduleAssignmentsByRun>> =
        [];

      if (scheduleRunId) {
        const existing = await dbSchedulerStorage.getSchedulerRun(scheduleRunId);
        if (!existing || existing.orgId !== orgId) {
          return sendNotFound(res, "Scheduler run");
        }
        assignments = await dbSchedulerStorage.getScheduleAssignmentsByRun(scheduleRunId);
      } else if (draftAssignments && Array.isArray(draftAssignments)) {
        assignments = draftAssignments;
      } else {
        return sendBadRequest(res, "Either scheduleRunId or assignments array is required");
      }

      if (assignments.length === 0) {
        return res.json({
          isCompliant: true,
          violations: [],
          summary: { totalCrew: 0, compliantCrew: 0, violationCount: 0, warningCount: 0 },
        });
      }
      const result = await previewScheduleCompliance(orgId, assignments);
      return res.json(result);
    })
  );

  app.post(
    "/api/schedule/runs/:id/generate-hor",
    crewOperationRateLimit,
    withErrorHandling(
      "generate Hours of Rest",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { id } = idParamSchema.parse(req.params);
        const existing = await dbSchedulerStorage.getSchedulerRun(id);

        if (!existing || existing.orgId !== orgId) {
          return sendNotFound(res, "Scheduler run");
        }
        const result = await generateHoRFromSchedule(id);

        if (result.success) {
          return res.json({
            ...result,
            success: true,
            message: `Generated ${result.sheetsCreated} rest sheets with ${result.daysCreated} days`,
          });
        }
        return res.status(400).json({ ...result, success: false, errors: result.errors });
      }
    )
  );
}
