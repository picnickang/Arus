/**
 * Work Order Completion Routes
 *
 * Completion workflow, completions list, and analytics.
 */

import type { Express, Request, Response } from "express";
import { insertWorkOrderCompletionSchema } from "@shared/schema-runtime";
import { workOrderAppService as workOrderService } from "../application";
import { requireOrgId, requireOrgIdAndValidateBody, AuthenticatedRequest } from "../../../middleware/auth";
import { withErrorHandling, sendNotFound, sendCreated } from "../../../lib/route-utils";
import type { RateLimitMiddleware } from "./types";

export function registerCompletionRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const { writeOperationRateLimit } = rateLimit;

  app.post("/api/work-orders/:id/complete", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("complete work order", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const workOrderId = req.params.id;
      const now = new Date();

      const laborCost = req.body.laborCost ?? req.body.totalLaborCost ?? 0;
      const partsCost = req.body.partsCost ?? req.body.totalPartsCost ?? 0;
      const downtimeCost = req.body.downtimeCost ?? 0;
      const totalCost = req.body.totalCost ?? laborCost + partsCost + downtimeCost;

      const preprocessedBody = {
        ...req.body,
        completedAt: req.body.completedAt ? new Date(req.body.completedAt) : now,
        plannedStartDate: req.body.plannedStartDate
          ? new Date(req.body.plannedStartDate)
          : undefined,
        plannedEndDate: req.body.plannedEndDate ? new Date(req.body.plannedEndDate) : undefined,
        actualStartDate: req.body.actualStartDate
          ? new Date(req.body.actualStartDate)
          : undefined,
        actualEndDate: req.body.actualEndDate ? new Date(req.body.actualEndDate) : undefined,
        totalLaborCost: laborCost,
        totalPartsCost: partsCost,
        totalCost,
        workOrderId,
        orgId,
      };

      const workOrder = await workOrderService.getWorkOrderById(workOrderId, orgId);
      if (!workOrder) {
        return sendNotFound(res, "Work order");
      }

      const completionData = insertWorkOrderCompletionSchema.parse({
        ...preprocessedBody,
        equipmentId: workOrder.equipmentId,
        vesselId: workOrder.vesselId || undefined,
      });

      if (req.body.workOrderId && req.body.workOrderId !== workOrderId) {
        return res.status(400).json({ message: "Work order ID mismatch" });
      }

      const completion = await workOrderService.completeWorkOrder(
        workOrderId,
        completionData,
        orgId
      );

      sendCreated(res, completion);
    })
  );

  app.get("/api/work-order-completions", requireOrgId,
    withErrorHandling("fetch work order completions", async (req: Request, res: Response) => {
      const { equipmentId, vesselId, startDate, endDate } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;

      const filters = {
        equipmentId: equipmentId as string | undefined,
        vesselId: vesselId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        orgId,
      };

      const completions = await workOrderService.getCompletions(filters);
      res.json(completions);
    })
  );

  app.get("/api/work-order-completions/analytics", requireOrgId,
    withErrorHandling("fetch work order completion analytics", async (req: Request, res: Response) => {
      const { equipmentId, vesselId, startDate, endDate } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;

      const filters = {
        equipmentId: equipmentId as string | undefined,
        vesselId: vesselId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        orgId,
      };

      const analytics = await workOrderService.getWorkOrderCompletionAnalytics(filters);
      res.json(analytics);
    })
  );

  app.get("/api/work-order-completions/:id", requireOrgId,
    withErrorHandling("fetch work order completion", async (req: Request, res: Response) => {
      const completion = await workOrderService.getWorkOrderCompletion(req.params.id);
      if (!completion) {
        return sendNotFound(res, "Work order completion");
      }
      res.json(completion);
    })
  );

  app.get("/api/work-orders/:id/completions", requireOrgId,
    withErrorHandling("fetch work order completions", async (req: Request, res: Response) => {
      const completions = await workOrderService.getWorkOrderCompletionsByWorkOrder(req.params.id);
      res.json(completions);
    })
  );
}
