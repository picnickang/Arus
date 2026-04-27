import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { validateResponse } from "../../../lib/api-helpers";
import { withErrorHandling } from "../../../lib/route-utils";
import { attentionWorkflowService } from "../application/attention-service.js";

const workflowSeveritySchema = z.enum(["critical", "warning", "info", "success"]);
const workflowQueueIdSchema = z.enum([
  "needs_review",
  "open_work",
  "due_today",
  "blocked",
  "waiting_parts",
  "ready_to_close",
  "completed",
  "overdue",
]);

const attentionWorkflowItemSchema = z.object({
  id: z.string(),
  type: z.enum(["work_order", "alert", "equipment", "inventory", "handover", "system"]),
  sourceId: z.string().optional(),
  title: z.string(),
  source: z.string(),
  whyItMatters: z.string(),
  recommendedAction: z.string(),
  owner: z.string(),
  due: z.string(),
  href: z.string(),
  severity: workflowSeveritySchema,
  queue: workflowQueueIdSchema,
  status: z.string().nullable().optional(),
  blockerReason: z.string().nullable().optional(),
});

const attentionWorkflowQueueSchema = z.object({
  id: workflowQueueIdSchema,
  label: z.string(),
  description: z.string(),
  count: z.number().int().nonnegative(),
  href: z.string(),
  severity: workflowSeveritySchema,
});

const attentionWorkflowResponseSchema = z.object({
  generatedAt: z.string(),
  items: z.array(attentionWorkflowItemSchema),
  queues: z.array(attentionWorkflowQueueSchema),
  handover: z.object({
    openAttentionItems: z.number().int().nonnegative(),
    criticalItems: z.number().int().nonnegative(),
    blockedJobs: z.number().int().nonnegative(),
    readyForCloseout: z.number().int().nonnegative(),
    openWorkOrders: z.number().int().nonnegative(),
    lowStockParts: z.number().int().nonnegative(),
    suggestedSummary: z.array(z.string()),
  }),
});

export function registerWorkflowRoutes(
  app: Express,
  deps: { generalApiRateLimit: any; requireOrgId: any }
) {
  const { generalApiRateLimit, requireOrgId } = deps;

  app.get(
    "/api/attention/items",
    generalApiRateLimit,
    requireOrgId,
    withErrorHandling("get attention workflow items", async (req: Request, res: Response) => {
      const orgId = (req as { orgId?: string }).orgId || DEFAULT_ORG_ID;
      const workflow = await attentionWorkflowService.getWorkflow(orgId);
      res.json(validateResponse(attentionWorkflowResponseSchema, workflow, "GET /api/attention/items"));
    })
  );
}
