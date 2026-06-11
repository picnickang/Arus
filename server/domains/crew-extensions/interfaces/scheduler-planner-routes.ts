import type { Express, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { crewExtensionsAppService, scheduleSimulationService } from "../application/index.js";
import type { AuthenticatedRequest, CrewExtensionsRoutesConfig } from "./types.js";
import {
  commitSchema,
  plannerSimulateSchema,
  plannerViewQuerySchema,
  previewQuerySchema,
  refreshRequestSchema,
} from "./scheduler-route-schemas.js";

export function registerSchedulerPlannerRoutes(
  app: Express,
  config: CrewExtensionsRoutesConfig
): void {
  const { crewOperationRateLimit } = config;

  app.get(
    "/api/crew-extensions/scheduler/planner-view",
    withErrorHandling(
      "get schedule planner view",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;

        const parseResult = plannerViewQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid query parameters",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }

        const { startDate, endDate, vesselIds, crewIds, roles, status, includeUnfilled } =
          parseResult.data;

        const filter = {
          orgId,
          startDate: startDate || new Date().toISOString().split("T")[0],
          endDate:
            endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          vesselIds: vesselIds ? vesselIds.split(",").filter(Boolean) : undefined,
          crewIds: crewIds ? crewIds.split(",").filter(Boolean) : undefined,
          roles: roles ? roles.split(",").filter(Boolean) : undefined,
          status: status ? status.split(",").filter(Boolean) : undefined,
          includeUnfilled: includeUnfilled !== "false",
        };
        const view = await crewExtensionsAppService.getSchedulePlannerView(
          filter as Parameters<typeof crewExtensionsAppService.getSchedulePlannerView>[0]
        );
        return res.json(view);
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/planner-view/refresh",
    crewOperationRateLimit,
    withErrorHandling(
      "refresh schedule planner view",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id || "system";

        const parseResult = refreshRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }
        await crewExtensionsAppService.refreshSchedulePlannerView(orgId, userId);
        return res.json({ success: true, refreshedAt: new Date().toISOString() });
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/simulate",
    crewOperationRateLimit,
    withErrorHandling(
      "simulate schedule generation",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id;

        const parseResult = plannerSimulateSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }

        const { from, days, vessels, crewIds, strategy } = parseResult.data;
        const preview = await scheduleSimulationService.simulate(
          {
            orgId,
            from,
            days,
            vessels,
            crewIds,
            strategy,
          },
          userId
        );

        return res.json({
          previewId: preview.previewId,
          expiresAt: preview.expiresAt.toISOString(),
          proposedAssignments: preview.proposedAssignments,
          unfilledShifts: preview.unfilledShifts,
          compliance: preview.compliance,
          diff: preview.diff,
          summary: preview.summary,
        });
      }
    )
  );

  app.get(
    "/api/crew-extensions/scheduler/preview",
    withErrorHandling(
      "get simulation preview",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const { previewId } = previewQuerySchema.parse(req.query);
        let preview;
        if (previewId && typeof previewId === "string") {
          preview = await scheduleSimulationService.getPreview(previewId, orgId);
        } else {
          preview = await scheduleSimulationService.getLatestPreview(orgId);
        }

        if (!preview) {
          return res.status(404).json({
            error: "No simulation preview found",
            message: previewId ? "Preview may have expired" : "No active simulation",
          });
        }

        return res.json({
          previewId: preview.previewId,
          createdAt: preview.createdAt.toISOString(),
          expiresAt: preview.expiresAt.toISOString(),
          command: preview.command,
          proposedAssignments: preview.proposedAssignments,
          unfilledShifts: preview.unfilledShifts,
          compliance: preview.compliance,
          diff: preview.diff,
          summary: preview.summary,
        });
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/preview/commit",
    crewOperationRateLimit,
    withErrorHandling(
      "commit simulation preview",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id;

        const parseResult = commitSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          });
        }

        const { previewId, selectedAssignmentIds } = parseResult.data;
        const result = await scheduleSimulationService.commit(
          {
            previewId,
            orgId,
            userId,
            selectedAssignmentIds,
          },
          userId
        );

        return res.json({
          success: true,
          runId: result.runId,
          assignmentsCreated: result.assignmentsCreated,
          message: `Committed ${result.assignmentsCreated} assignments to scheduler run ${result.runId}`,
        });
      }
    )
  );

  app.post(
    "/api/crew-extensions/scheduler/preview/discard",
    crewOperationRateLimit,
    withErrorHandling(
      "discard simulation preview",
      async (req: AuthenticatedRequest, res: Response) => {
        const orgId = req.orgId!;
        const userId = req.session?.user?.id;
        const { previewId } = previewQuerySchema.parse(req.body ?? {});

        if (!previewId || typeof previewId !== "string") {
          return res.status(400).json({ error: "previewId is required" });
        }
        const deleted = await scheduleSimulationService.discard(previewId, orgId, "manual", userId);

        return res.json({
          success: deleted,
          message: deleted
            ? "Simulation preview discarded"
            : "Preview not found or already expired",
        });
      }
    )
  );
}
