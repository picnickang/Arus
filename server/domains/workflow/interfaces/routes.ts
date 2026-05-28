import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { validateResponse } from "../../../lib/api-helpers";
import { withErrorHandling } from "../../../lib/route-utils";
import { requireRole } from "../../../middleware/role-auth";
import {
  AttentionWorkflowService,
  createAttentionWorkflowService,
} from "../application/attention-service.js";
import type { AttentionWorkflowSources } from "../domain/ports.js";

// Command-queue surface (Attention Inbox) is admin-portal only.
// Mirrors `getPortalForRole` in
// `client/src/application/navigation/role-navigation-policy.ts`:
// portal-level admin roles get access; deck_officer/viewer (user
// portal) do not.
const ATTENTION_INBOX_ROLES = [
  "system_admin",
  "company_admin",
  "chief_engineer",
  "fleet_manager",
  "captain",
  "admin",
] as const;
const requireAttentionInboxRole = requireRole(...ATTENTION_INBOX_ROLES);

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
const sourceHealthStatusSchema = z.enum(["ok", "failed", "not_configured"]);
const blockerResolutionStatusSchema = z.enum(["updated", "waiting", "unblocked", "deferred"]);

const blockerResolutionSummarySchema = z.object({
  status: blockerResolutionStatusSchema,
  owner: z.string().optional(),
  eta: z.string().optional(),
  note: z.string().optional(),
  savedAt: z.string(),
});

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
  lastResolution: blockerResolutionSummarySchema.nullable().optional(),
});

const attentionWorkflowQueueSchema = z.object({
  id: workflowQueueIdSchema,
  label: z.string(),
  description: z.string(),
  count: z.number().int().nonnegative(),
  href: z.string(),
  severity: workflowSeveritySchema,
});

const handoverRecordSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  note: z.string(),
  watchLabel: z.string().optional(),
  generatedSummary: z.string(),
  itemIds: z.array(z.string()),
  authorId: z.string().optional(),
  status: z.enum(["draft", "shared", "acknowledged"]),
  savedAt: z.string(),
});

const blockerResolutionRecordSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  itemId: z.string(),
  workOrderId: z.string().optional(),
  inventoryItemId: z.string().optional(),
  blockerType: z.string(),
  reason: z.string(),
  owner: z.string().optional(),
  eta: z.string().optional(),
  status: blockerResolutionStatusSchema,
  note: z.string().optional(),
  savedAt: z.string(),
  authorId: z.string().optional(),
});

const issueReportRecordSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  summary: z.string(),
  vessel: z.string().optional(),
  equipment: z.string().optional(),
  location: z.string().optional(),
  impact: z.string().optional(),
  evidenceNote: z.string().optional(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  target: z.enum(["work_order", "finding", "log_note", "handover"]),
  suggestedHref: z.string(),
  status: z.enum(["draft", "submitted"]),
  createdAt: z.string(),
  authorId: z.string().optional(),
});

const attentionWorkflowResponseSchema = z.object({
  generatedAt: z.string(),
  items: z.array(attentionWorkflowItemSchema),
  queues: z.array(attentionWorkflowQueueSchema),
  handover: z.object({
    openAttentionItems: z.number().int().nonnegative(),
    criticalItems: z.number().int().nonnegative(),
    blockedJobs: z.number().int().nonnegative(),
    waitingOnParts: z.number().int().nonnegative(),
    readyForCloseout: z.number().int().nonnegative(),
    openWorkOrders: z.number().int().nonnegative(),
    lowStockParts: z.number().int().nonnegative(),
    suggestedSummary: z.array(z.string()),
  }),
  sources: z.object({
    workOrders: sourceHealthStatusSchema,
    alerts: sourceHealthStatusSchema,
    equipment: sourceHealthStatusSchema,
    inventory: sourceHealthStatusSchema,
    errors: z.record(z.string()).optional(),
  }),
});

const saveHandoverSchema = z.object({
  note: z.string().max(10_000),
  watchLabel: z.string().max(120).optional(),
  generatedSummary: z.string().max(20_000).optional(),
  itemIds: z.array(z.string()).max(50).optional(),
  status: z.enum(["draft", "shared", "acknowledged"]).optional(),
});

const saveBlockerResolutionSchema = z.object({
  itemId: z.string().optional(),
  workOrderId: z.string().optional(),
  inventoryItemId: z.string().optional(),
  blockerType: z.string().max(120).optional(),
  reason: z.string().max(2_000).optional(),
  owner: z.string().max(120).optional(),
  eta: z.string().max(120).optional(),
  status: blockerResolutionStatusSchema.optional(),
  note: z.string().max(5_000).optional(),
});

const reportIssueSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  summary: z.string().min(2).max(500),
  vessel: z.string().max(120).optional(),
  equipment: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  impact: z.string().max(2_000).optional(),
  evidenceNote: z.string().max(2_000).optional(),
  owner: z.string().max(120).optional(),
  dueDate: z.string().max(120).optional(),
  target: z.enum(["work_order", "finding", "log_note", "handover"]).optional(),
  status: z.enum(["draft", "submitted"]).optional(),
});

function getOrgId(req: Request): string {
  return (req as { orgId?: string }).orgId || DEFAULT_ORG_ID;
}

function getUserId(req: Request): string | undefined {
  return (req as { user?: { id?: string } }).user?.id;
}

export function registerWorkflowRoutes(
  app: Express,
  deps: {
    generalApiRateLimit: import("express").RequestHandler;
    writeOperationRateLimit?: import("express").RequestHandler;
    requireOrgId: import("express").RequestHandler;
    sources: AttentionWorkflowSources;
  }
) {
  const {
    generalApiRateLimit,
    writeOperationRateLimit = generalApiRateLimit,
    requireOrgId,
    sources,
  } = deps;
  const service: AttentionWorkflowService = createAttentionWorkflowService(sources);

  app.get(
    "/api/attention/items",
    generalApiRateLimit,
    requireOrgId,
    requireAttentionInboxRole,
    withErrorHandling("get attention workflow items", async (req: Request, res: Response) => {
      const workflow = await service.getWorkflow(getOrgId(req));
      res.json(validateResponse(attentionWorkflowResponseSchema, workflow, "GET /api/attention/items"));
    })
  );

  app.get(
    "/api/attention/handover/latest",
    generalApiRateLimit,
    requireOrgId,
    requireAttentionInboxRole,
    withErrorHandling("get latest workflow handover", async (req: Request, res: Response) => {
      const record = await service.getLatestHandover(getOrgId(req));
      res.json(validateResponse(handoverRecordSchema.nullable(), record, "GET /api/attention/handover/latest"));
    })
  );

  app.get(
    "/api/attention/handovers",
    generalApiRateLimit,
    requireOrgId,
    requireAttentionInboxRole,
    withErrorHandling("list workflow handovers", async (req: Request, res: Response) => {
      const records = await service.listHandovers(getOrgId(req));
      res.json(validateResponse(z.array(handoverRecordSchema), records, "GET /api/attention/handovers"));
    })
  );

  app.post(
    "/api/attention/handover",
    writeOperationRateLimit,
    requireOrgId,
    requireAttentionInboxRole,
    withErrorHandling("save workflow handover", async (req: Request, res: Response) => {
      const payload = saveHandoverSchema.parse(req.body);
      const record = await service.saveHandover(getOrgId(req), payload, getUserId(req));
      res.status(201).json(validateResponse(handoverRecordSchema, record, "POST /api/attention/handover"));
    })
  );

  app.post(
    "/api/attention/blocker-resolutions",
    writeOperationRateLimit,
    requireOrgId,
    requireAttentionInboxRole,
    withErrorHandling("save blocker resolution", async (req: Request, res: Response) => {
      const payload = saveBlockerResolutionSchema.parse(req.body);
      const record = await service.saveBlockerResolution(getOrgId(req), payload, getUserId(req));
      res.status(201).json(
        validateResponse(blockerResolutionRecordSchema, record, "POST /api/attention/blocker-resolutions")
      );
    })
  );

  app.post(
    "/api/attention/issues",
    writeOperationRateLimit,
    requireOrgId,
    requireAttentionInboxRole,
    withErrorHandling("report workflow issue", async (req: Request, res: Response) => {
      const payload = reportIssueSchema.parse(req.body);
      const record = await service.reportIssue(getOrgId(req), payload, getUserId(req));
      res.status(201).json(validateResponse(issueReportRecordSchema, record, "POST /api/attention/issues"));
    })
  );
}
