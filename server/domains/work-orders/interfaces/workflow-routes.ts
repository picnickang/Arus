import type { Express, Request, Response } from "express";
import { requireOrgId, requireOrgIdAndValidateBody } from "../../../middleware/auth";
import { withErrorHandling, sendCreated, sendNotFound } from "../../../lib/route-utils";
import type { WorkOrderWorkflowService } from "../application/wo-workflow-service";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

import type { AuthenticatedRequest } from "../../../middleware/auth";

function getOrgId(req: Request): string {
  return (req as AuthenticatedRequest).orgId || DEFAULT_ORG_ID;
}

function getUserId(req: Request): string {
  const r = req as AuthenticatedRequest & {
    userId?: string;
    user?: { id?: string };
  };
  const header = req.headers["x-user-id"];
  return (
    r.userId ||
    r.user?.id ||
    (Array.isArray(header) ? header[0] : header) ||
    "unknown"
  );
}

export function registerWorkOrderWorkflowRoutes(
  app: Express,
  service: WorkOrderWorkflowService,
  rateLimiters: {
    writeOperationRateLimit: import("express").RequestHandler;
    generalApiRateLimit: import("express").RequestHandler;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  app.post(
    "/api/work-orders/quick",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("quick work order creation", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const { equipmentId, description, priority, photoBase64, vesselId } = req.body;

      if (!equipmentId || !description || !priority) {
        return res.status(400).json({
          error: "equipmentId, description, and priority are required",
        });
      }

      if (!["low", "medium", "high"].includes(priority)) {
        return res.status(400).json({
          error: "priority must be low, medium, or high",
        });
      }

      const result = await service.createQuick(orgId, {
        equipmentId,
        description,
        priority,
        photoBase64,
        vesselId,
      });

      sendCreated(res, result);
      return undefined;
    })
  );

  app.post(
    "/api/work-orders/:id/complete-with-feedback",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("complete work order with feedback", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);
      const workOrderId = req.params['id'] ?? '';

      const { completionNotes, actualHours, actualDowntimeHours, closeout, predictionFeedback } = req.body;

      if (predictionFeedback) {
        const validOutcomes = ["confirmed", "partial", "false_alarm"];
        if (!validOutcomes.includes(predictionFeedback.outcome)) {
          return res.status(400).json({
            error: `predictionFeedback.outcome must be one of: ${validOutcomes.join(", ")}`,
          });
        }
      }

      const result = await service.completeWithFeedback(
        {
          workOrderId,
          orgId,
          ...(completionNotes !== undefined && { completionNotes }),
          ...(actualHours !== undefined && { actualHours }),
          ...(actualDowntimeHours !== undefined && { actualDowntimeHours }),
          ...(closeout !== undefined && { closeout }),
          predictionFeedback: predictionFeedback
            ? {
                workOrderId,
                predictionId: predictionFeedback.predictionId,
                outcome: predictionFeedback.outcome,
                notes: predictionFeedback.notes,
              }
            : undefined,
        },
        userId
      );

      if (!result.completed) {
        if (result.error === "Work order not found") {
          return sendNotFound(res, "Work Order");
        }
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    })
  );

  app.post(
    "/api/work-orders/:id/cancel",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("cancel work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);
      const workOrderId = req.params['id'] ?? '';
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: "Cancellation reason is required" });
      }

      const result = await service.cancelWithVoid(workOrderId, orgId, reason, userId);

      if (!result.cancelled) {
        if (result.error === "Work order not found") {
          return sendNotFound(res, "Work Order");
        }
        return res.status(400).json({ error: result.error });
      }

      return res.json({ cancelled: result.cancelled, savingsVoided: result.savingsVoided });
    })
  );

  app.get(
    "/api/work-orders/:id/is-predictive",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("check if work order is predictive", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const workOrderId = req.params['id'] ?? '';

      const isPredictive = await service.woRepo.isPredictive(workOrderId, orgId);
      return res.json({ workOrderId, isPredictive });
    })
  );
}
