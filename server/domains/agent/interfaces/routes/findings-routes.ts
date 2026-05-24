import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { FindingsAggregatorService } from "../../application/findings-service";
import type { FindingsFilter, FindingsPagination } from "../../domain/findings-types";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface FindingsRouteDeps {
  findingsService: FindingsAggregatorService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

const findingsQuerySchema = z.object({
  source: z.enum(["suggestion", "draft", "schedule_run", "agent_finding"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  status: z
    .enum([
      "pending",
      "acted",
      "dismissed",
      "deferred",
      "approved",
      "rejected",
      "completed",
      "failed",
      "running",
    ])
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function registerFindingsRoutes(app: Express, deps: FindingsRouteDeps) {
  const { findingsService, rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/findings",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const parsed = findingsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "Invalid query", details: parsed.error.flatten().fieldErrors });
        }
        const q = parsed.data;
        const filter: FindingsFilter = {};
        if (q.source) filter.source = q.source;
        if (q.severity) filter.severity = q.severity;
        if (q.status) filter.status = q.status;
        if (q.dateFrom) {
          if (isNaN(new Date(q.dateFrom).getTime())) {
            return res.status(400).json({ error: "Invalid dateFrom" });
          }
          filter.dateFrom = q.dateFrom;
        }
        if (q.dateTo) {
          if (isNaN(new Date(q.dateTo).getTime())) {
            return res.status(400).json({ error: "Invalid dateTo" });
          }
          filter.dateTo = q.dateTo;
        }

        const pagination: FindingsPagination = {
          limit: Math.min(Math.max(q.limit ?? 50, 1), 200),
          offset: q.offset ?? 0,
        };

        const result = await findingsService.getFindings(orgId, filter, pagination);
        return res.json(result);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/findings/summary",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const summary = await findingsService.getSummary(orgId);
        return res.json(summary);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
