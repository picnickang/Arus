import type { Express, Request, Response } from "express";
import { authenticatedRequest } from "../../../../middleware/auth";
import type { SafetyService } from "../../application/safety-service";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface UsageRouteDeps {
  safety: SafetyService;
  rateLimit: RateLimitMiddleware;
  requireAdminRole: RoleMiddleware;
}

export function registerUsageRoutes(app: Express, deps: UsageRouteDeps) {
  const { safety, rateLimit, requireAdminRole } = deps;

  app.get(
    "/api/agent/usage",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = authenticatedRequest(req).orgId;
        const days = parseInt(req.query['days'] as string) || 30;
        const stats = await safety.getUsageStats(orgId, days);
        res.json(stats);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
