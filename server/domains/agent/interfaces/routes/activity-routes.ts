import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { AgentActivityService } from "../../application/activity-service";
import type { ActivityFilter } from "../../domain/activity-types";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface ActivityRouteDeps {
  activityService: AgentActivityService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

const activityQuerySchema = z.object({
  triggerType: z.enum(["scheduled", "user"]).optional(),
  status: z.enum(["completed", "failed", "running"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

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
        const q = activityQuerySchema.parse(req.query);
        const filter: ActivityFilter = {};
        if (q.triggerType) filter.triggerType = q.triggerType;
        if (q.status) filter.status = q.status;
        if (q.startDate) {
          const d = new Date(q.startDate);
          if (!isNaN(d.getTime())) filter.startDate = d;
        }
        if (q.endDate) {
          const d = new Date(q.endDate);
          if (!isNaN(d.getTime())) filter.endDate = d;
        }
        filter.limit = Math.min(q.limit ?? 50, 200);
        filter.offset = Math.max(q.offset ?? 0, 0);

        const items = await activityService.list(orgId, filter);
        res.json(items);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
