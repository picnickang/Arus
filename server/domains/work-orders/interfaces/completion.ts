/**
 * Work Order Completion Routes
 *
 * Completions list and analytics (read-only).
 * The legacy POST /api/work-orders/:id/complete route has been removed.
 * All completions go through POST /api/work-orders/:id/complete-with-feedback
 * in workflow-routes.ts.
 */

import type { Express, Request, Response } from "express";
import { workOrderAppService as workOrderService } from "../application";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils";
import type { RateLimitMiddleware } from "./types";

export function registerCompletionRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  app.get(
    "/api/work-order-completions",
    requireOrgId,
    withErrorHandling("fetch work order completions", async (req: Request, res: Response) => {
      const { equipmentId, vesselId, startDate, endDate } = req.query;
      const orgId = authenticatedRequest(req).orgId;

      const filters = {
        ...(typeof equipmentId === "string" && { equipmentId }),
        ...(typeof vesselId === "string" && { vesselId }),
        ...(startDate && { startDate: new Date(startDate as string) }),
        ...(endDate && { endDate: new Date(endDate as string) }),
        orgId,
      };

      const completions = await workOrderService.getCompletions(filters);
      res.json(completions);
    })
  );

  app.get(
    "/api/work-order-completions/analytics",
    requireOrgId,
    withErrorHandling(
      "fetch work order completion analytics",
      async (req: Request, res: Response) => {
        const { equipmentId, vesselId, startDate, endDate } = req.query;
        const orgId = authenticatedRequest(req).orgId;

        const filters = {
          ...(typeof equipmentId === "string" && { equipmentId }),
          ...(typeof vesselId === "string" && { vesselId }),
          ...(startDate && { startDate: new Date(startDate as string) }),
          ...(endDate && { endDate: new Date(endDate as string) }),
          orgId,
        };

        const analytics = await workOrderService.getWorkOrderCompletionAnalytics(filters);
        res.json(analytics);
      }
    )
  );

  app.get(
    "/api/work-order-completions/:id",
    requireOrgId,
    withErrorHandling("fetch work order completion", async (req: Request, res: Response) => {
      const completion = await workOrderService.getWorkOrderCompletion(req.params["id"] ?? "");
      if (!completion) {
        return sendNotFound(res, "Work order completion");
      }
      res.json(completion);
    })
  );

  app.get(
    "/api/work-orders/:id/completions",
    requireOrgId,
    withErrorHandling("fetch work order completions", async (req: Request, res: Response) => {
      const completions = await workOrderService.getWorkOrderCompletionsByWorkOrder(
        req.params["id"] ?? ""
      );
      res.json(completions);
    })
  );
}
