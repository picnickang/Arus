import type { Express, Request, Response } from "express";
import {
  authenticatedRequest,
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../../../middleware/auth";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { withErrorHandling, sendCreated, sendNotFound } from "../../../lib/route-utils";
import type { WorkOrderWorkflowService } from "../application/wo-workflow-service";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../../middleware/auth";

/**
 * P2 #22 — Zod-validated closeout payload for the
 * `complete-with-feedback` endpoint. Before this the route only
 * checked `predictionFeedback.outcome` and trusted the rest of the
 * body verbatim, so a client could send `actualHours: -10`,
 * `laborHours: Number.MAX_SAFE_INTEGER`, or arbitrary objects in
 * `closeout.partsUsed` and the persisted completion would carry
 * those values straight into reporting / cost rollups.
 *
 * Bounds chosen: a single work order rarely consumes more than one
 * shift × a few days × generous slack — 1000 hours is more than
 * enough headroom for a multi-week voyage repair and still rejects
 * obvious garbage. String fields are length-bounded to protect the
 * downstream column widths and JSON payload size.
 */
const MAX_HOURS = 1000;
const MAX_TEXT_LEN = 2000;
const MAX_NOTES_LEN = 4000;

const closeoutSchema = z
  .object({
    workPerformed: z.string().max(MAX_TEXT_LEN).optional(),
    causeFound: z.string().max(MAX_TEXT_LEN).optional(),
    partsUsed: z.string().max(MAX_TEXT_LEN).optional(),
    laborHours: z.number().finite().min(0).max(MAX_HOURS).nullable().optional(),
    downtimeHours: z.number().finite().min(0).max(MAX_HOURS).nullable().optional(),
    evidenceNote: z.string().max(MAX_NOTES_LEN).optional(),
    checklistVerified: z.boolean().optional(),
    supervisorVerified: z.boolean().optional(),
  })
  .strict();

const predictionFeedbackSchema = z.object({
  predictionId: z.union([z.string(), z.number(), z.null()]).optional(),
  outcome: z.enum(["confirmed", "partial", "false_alarm"]),
  notes: z.string().max(MAX_NOTES_LEN).optional(),
});

export const completeWithFeedbackSchema = z
  .object({
    // Tolerate the org-scoping middleware injecting orgId into the body; without
    // this the .strict() schema 400s every complete-with-feedback call.
    orgId: z.string().optional(),
    completionNotes: z.string().max(MAX_NOTES_LEN).optional(),
    actualHours: z.number().finite().min(0).max(MAX_HOURS).optional(),
    actualDowntimeHours: z.number().finite().min(0).max(MAX_HOURS).optional(),
    closeout: closeoutSchema.optional(),
    predictionFeedback: predictionFeedbackSchema.optional(),
  })
  .strict();
export { closeoutSchema as _closeoutSchemaForTests };

function getOrgId(req: Request): string {
  return authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
}

function getUserId(req: Request): string {
  const r = req as AuthenticatedRequest & {
    userId?: string;
    user?: { id?: string };
  };
  const header = req.headers["x-user-id"];
  return r.userId || r.user?.id || (Array.isArray(header) ? header[0] : header) || "unknown";
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
    // LR-3.5 / TX-2: completion is the highest-stakes write on a
    // work-order. The offline outbox replays mutations on
    // reconnect and a flaky network can issue the same POST twice;
    // without idempotency the second call double-records labour
    // hours, double-fires WORK_ORDER_COMPLETED via the outbox, and
    // double-applies prediction feedback. The shared
    // idempotencyMiddleware keys on `Idempotency-Key` OR a
    // `clientMutationId` carried in the body (the outbox queues
    // mutations with the latter), scoped per (orgId, method, path).
    idempotencyMiddleware(),
    writeOperationRateLimit,
    withErrorHandling("complete work order with feedback", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);
      const workOrderId = req.params["id"] ?? "";

      const parsed = completeWithFeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid completion payload",
          details: parsed.error.flatten(),
        });
      }
      const { completionNotes, actualHours, actualDowntimeHours, closeout, predictionFeedback } =
        parsed.data;

      // P2 #28 — Keep the explicit `!== undefined` pattern so that
      // explicit zeros and null clear-outs survive the spread. Zod
      // already accepted them; this guard is solely about whether
      // the key reaches the service input.
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
                predictionId: predictionFeedback.predictionId ?? null,
                outcome: predictionFeedback.outcome,
                ...(predictionFeedback.notes !== undefined && { notes: predictionFeedback.notes }),
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
    // LR-3.5 / TX-2: cancel voids realized savings + flips a WO terminal
    // state. The offline outbox can replay the same cancel POST on
    // reconnect; without idempotency a second call could re-void savings
    // and re-fire WORK_ORDER_CANCELLED. Same key surface as the
    // complete-with-feedback mount above (Idempotency-Key OR body
    // clientMutationId, scoped per (orgId, method, path)).
    idempotencyMiddleware(),
    writeOperationRateLimit,
    withErrorHandling("cancel work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const userId = getUserId(req);
      const workOrderId = req.params["id"] ?? "";
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
      const workOrderId = req.params["id"] ?? "";

      const isPredictive = await service.woRepo.isPredictive(workOrderId, orgId);
      return res.json({ workOrderId, isPredictive });
    })
  );
}
