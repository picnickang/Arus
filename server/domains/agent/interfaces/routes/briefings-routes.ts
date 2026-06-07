import type { Express, Request, Response } from "express";
import { authenticatedRequest } from "../../../../middleware/auth";
import type { BriefingGeneratorService } from "../../application/briefing-generator-service";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface BriefingsRouteDeps {
  getBriefingService: () => BriefingGeneratorService;
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

export function registerBriefingsRoutes(app: Express, deps: BriefingsRouteDeps) {
  const { getBriefingService, rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/briefings/latest",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const briefing = await (await getBriefingService()).getLatestForToday(orgId);
        if (!briefing) {
          return res.json(null);
        }
        return res.json(briefing);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/briefings",
    rateLimit.generalApiRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const dateStr = req.query['date'] as string | undefined;
        const limit = parseInt(req.query['limit'] as string) || 30;

        if (dateStr) {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
          }
          const briefings = await (await getBriefingService()).getByDate(orgId, date);
          return res.json(briefings);
        }

        const briefings = await (await getBriefingService()).list(orgId, limit);
        return res.json(briefings);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/briefings/generate",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const briefing = await (await getBriefingService()).generate(orgId);
        return res.json(briefing);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
