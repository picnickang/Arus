import type { Express, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import type { FindingsAggregatorService } from "../../application/findings-service";
import type { FindingsFilter, FindingsPagination } from "../../domain/findings-types";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface FindingsRouteDeps {
  findingsService: FindingsAggregatorService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

export function registerFindingsRoutes(app: Express, deps: FindingsRouteDeps) {
  const { findingsService, rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/findings",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const filter: FindingsFilter = {};

        const validSources = ["suggestion", "draft", "schedule_run", "agent_finding"];
        const validSeverities = ["info", "warning", "critical"];
        const validStatuses = [
          "pending",
          "acted",
          "dismissed",
          "deferred",
          "approved",
          "rejected",
          "completed",
          "failed",
          "running",
        ];

        if (req.query.source) {
          const src = req.query.source as string;
          if (!validSources.includes(src)) {
            return res.status(400).json({ error: `Invalid source: ${src}` });
          }
          filter.source = src as FindingsFilter["source"];
        }
        if (req.query.severity) {
          const sev = req.query.severity as string;
          if (!validSeverities.includes(sev)) {
            return res.status(400).json({ error: `Invalid severity: ${sev}` });
          }
          filter.severity = sev as FindingsFilter["severity"];
        }
        if (req.query.status) {
          const st = req.query.status as string;
          if (!validStatuses.includes(st)) {
            return res.status(400).json({ error: `Invalid status: ${st}` });
          }
          filter.status = st as FindingsFilter["status"];
        }
        if (req.query.dateFrom) {
          const d = new Date(req.query.dateFrom as string);
          if (isNaN(d.getTime())) {
            return res.status(400).json({ error: "Invalid dateFrom" });
          }
          filter.dateFrom = req.query.dateFrom as string;
        }
        if (req.query.dateTo) {
          const d = new Date(req.query.dateTo as string);
          if (isNaN(d.getTime())) {
            return res.status(400).json({ error: "Invalid dateTo" });
          }
          filter.dateTo = req.query.dateTo as string;
        }

        const rawOffset = parseInt(req.query.offset as string);
        const pagination: FindingsPagination = {
          limit: Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200),
          offset: isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset,
        };

        const result = await findingsService.getFindings(orgId, filter, pagination);
        res.json(result);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        res.json(summary);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
