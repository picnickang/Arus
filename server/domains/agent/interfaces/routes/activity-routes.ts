import type { Express, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { AgentActivityService } from "../../application/activity-service";
import type { ActivityFilter } from "../../domain/activity-types";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface ActivityRouteDeps {
  activityService: AgentActivityService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

export function registerActivityRoutes(app: Express, deps: ActivityRouteDeps) {
  const { activityService, rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/activity/summary",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const summary = await activityService.summary(orgId);
        res.json(summary);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/activity",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const filter: ActivityFilter = {};
        if (
          req.query.triggerType &&
          ["scheduled", "user"].includes(req.query.triggerType as string)
        ) {
          filter.triggerType = req.query.triggerType as "scheduled" | "user";
        }
        if (
          req.query.status &&
          ["completed", "failed", "running"].includes(req.query.status as string)
        ) {
          filter.status = req.query.status as "completed" | "failed" | "running";
        }
        if (req.query.startDate) {
          const d = new Date(req.query.startDate as string);
          if (!isNaN(d.getTime())) {
            filter.startDate = d;
          }
        }
        if (req.query.endDate) {
          const d = new Date(req.query.endDate as string);
          if (!isNaN(d.getTime())) {
            filter.endDate = d;
          }
        }
        filter.limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        filter.offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

        const items = await activityService.list(orgId, filter);
        res.json(items);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
