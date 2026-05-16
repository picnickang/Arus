import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validateResponse } from "../../../../../lib/api-helpers";
import { withErrorHandling } from "../../../../../lib/route-utils";
import type { RoleInformationNeedsService } from "../application/role-information-needs.service.js";

const roleSchema = z.enum([
  "chief_engineer",
  "second_engineer",
  "deck_officer",
  "technician",
  "fleet_manager",
  "superintendent",
  "system_admin",
]);

const informationNeedCategorySchema = z.enum([
  "risk",
  "work",
  "compliance",
  "handover",
  "inventory",
  "system",
  "business",
]);
const prioritySchema = z.enum(["routine", "important", "urgent", "critical"]);
const statusSchema = z.enum(["healthy", "watch", "needs_attention", "critical"]);
const businessGoalSchema = z.enum(["trust", "conversion", "retention", "safety", "uptime"]);

const roleInformationNeedSchema = z.object({
  id: z.string(),
  role: roleSchema,
  category: informationNeedCategorySchema,
  title: z.string(),
  userQuestion: z.string(),
  informationNeeded: z.array(z.string()),
  sourceSignals: z.array(z.string()),
  primaryAction: z.string(),
  route: z.string(),
  uiPattern: z.string(),
  trustEvidence: z.array(z.string()),
  businessGoal: businessGoalSchema,
  basePriority: prioritySchema,
  priority: prioritySchema,
  status: statusSchema,
  reason: z.string(),
  recommendedCta: z.string(),
  metricValue: z.number().nullable(),
});

const roleInformationNeedSummarySchema = z.object({
  generatedAt: z.string(),
  orgId: z.string(),
  role: roleSchema,
  roleLabel: z.string(),
  headline: z.string(),
  primaryQuestion: z.string(),
  topNeeds: z.array(roleInformationNeedSchema),
  needs: z.array(roleInformationNeedSchema),
  trustChecklist: z.array(z.string()),
  uxGuidance: z.object({
    clarity: z.string(),
    speed: z.string(),
    simplicity: z.string(),
    trust: z.string(),
    retention: z.string(),
  }),
});

const querySchema = z.object({
  role: roleSchema.default("chief_engineer"),
});

function getOrgId(req: Request): string {
  const orgId = (req as { orgId?: string }).orgId;
  if (!orgId) {
    throw Object.assign(new Error("Organization context is required"), { statusCode: 401 });
  }
  return orgId;
}

export function createRoleInformationNeedsRouter(service: RoleInformationNeedsService): Router {
  const router = Router();

  router.get(
    "/",
    withErrorHandling("get role information needs", async (req: Request, res: Response) => {
      const query = querySchema.parse(req.query);
      const summary = await service.buildSummary(getOrgId(req), query.role);
      res.json(validateResponse(roleInformationNeedSummarySchema, summary, "GET /api/operator-experience/information-needs"));
    })
  );

  router.get(
    "/roles",
    withErrorHandling("list role information need roles", async (_req: Request, res: Response) => {
      res.json(validateResponse(z.array(roleSchema), service.listRoles(), "GET /api/operator-experience/information-needs/roles"));
    })
  );

  return router;
}
