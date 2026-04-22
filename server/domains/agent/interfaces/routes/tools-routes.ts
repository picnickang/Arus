import type { Express, Request, Response } from "express";
import { getToolSummaries } from "../../tools";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface ToolsRouteDeps {
  rateLimit: RateLimitMiddleware;
  requireAdminRole: RoleMiddleware;
}

export function registerToolsRoutes(app: Express, deps: ToolsRouteDeps) {
  const { rateLimit, requireAdminRole } = deps;

  app.get(
    "/api/agent/tools",
    rateLimit.generalApiRateLimit,
    requireAdminRole,
    async (_req: Request, res: Response) => {
      try {
        res.json(getToolSummaries());
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
