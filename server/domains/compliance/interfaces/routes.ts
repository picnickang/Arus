import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import type { RateLimit } from "../../../lib/rate-limit-factory";
import { authenticatedRequest } from "../../../middleware/auth";
import { complianceService } from "../application";

interface RateLimiters {
  writeOperationRateLimit: RateLimit;
  criticalOperationRateLimit: RateLimit;
  generalApiRateLimit: RateLimit;
}

const findingsFiltersSchema = z.object({
  vesselId: z.string().optional(),
  sourceType: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  ruleCode: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // LR-3.5 / AUD-1 (Task #208): opt-in to seeing soft-archived rows.
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const findingByIdQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const rulesFiltersSchema = z.object({
  sourceType: z.string().optional(),
  category: z.string().optional(),
  enabled: z.enum(["true", "false"]).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });
const vesselIdParamSchema = z.object({ vesselId: z.string().min(1) });

const createFindingSchema = jsonRecordSchema;
const createRuleSchema = jsonRecordSchema;
const updateRuleSchema = jsonRecordSchema;

const acknowledgeBodySchema = z.object({
  acknowledgedByUserId: z.string().min(1),
  acknowledgedByUserName: z.string().min(1),
});

const resolveBodySchema = z.object({
  resolvedByUserId: z.string().min(1),
  resolvedByUserName: z.string().min(1),
  resolutionNotes: z.string().optional(),
});

const suppressBodySchema = z.object({
  suppressedUntil: z.string().min(1),
  suppressedReason: z.string().min(1),
});

const complianceCheckBodySchema = z.object({
  vesselId: z.string().min(1),
  logDate: z.string().min(1),
  logType: z.enum(["deck", "engine"]),
});

const stcwSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const stcwTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  vesselId: z.string().optional(),
});

export function registerComplianceRoutes(app: Express, rateLimiters?: RateLimiters): void {
  const passThrough: RequestHandler = (_req, _res, next) => next();
  const writeOperationRateLimit: RateLimit = rateLimiters?.writeOperationRateLimit ?? passThrough;
  const criticalOperationRateLimit: RateLimit =
    rateLimiters?.criticalOperationRateLimit ?? passThrough;

  // ===== COMPLIANCE RULES ENGINE ROUTES =====

  app.get(
    "/api/compliance/findings",
    withErrorHandling("get compliance findings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const filters = findingsFiltersSchema.parse(req.query);

      const findings = await complianceService.getComplianceFindings(orgId!, filters);
      res.json(findings);
    })
  );

  app.get(
    "/api/compliance/findings/:id",
    withErrorHandling("get compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const { includeArchived } = findingByIdQuerySchema.parse(req.query);
      const finding = await complianceService.getComplianceFindingById(id, orgId!, {
        includeArchived,
      });

      if (!finding) {
        return sendNotFound(res, "Compliance finding");
      }

      res.json(finding);
    })
  );

  app.post(
    "/api/compliance/findings",
    writeOperationRateLimit,
    withErrorHandling("create compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const body = createFindingSchema.parse(req.body);
      const finding = await complianceService.createComplianceFinding({
        ...body,
        orgId,
      } as Parameters<typeof complianceService.createComplianceFinding>[0]);
      res.status(201).json(finding);
    })
  );

  app.post(
    "/api/compliance/findings/:id/acknowledge",
    writeOperationRateLimit,
    withErrorHandling("acknowledge compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const { acknowledgedByUserId, acknowledgedByUserName } = acknowledgeBodySchema.parse(
        req.body
      );

      const finding = await complianceService.acknowledgeComplianceFinding(
        id,
        { acknowledgedByUserId, acknowledgedByUserName },
        orgId!
      );
      res.json(finding);
    })
  );

  app.post(
    "/api/compliance/findings/:id/resolve",
    writeOperationRateLimit,
    withErrorHandling("resolve compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const { resolvedByUserId, resolvedByUserName, resolutionNotes } = resolveBodySchema.parse(
        req.body
      );

      const finding = await complianceService.resolveComplianceFinding(
        id,
        { resolvedByUserId, resolvedByUserName, resolutionNotes },
        orgId!
      );
      res.json(finding);
    })
  );

  app.post(
    "/api/compliance/findings/:id/suppress",
    writeOperationRateLimit,
    withErrorHandling("suppress compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const { suppressedUntil, suppressedReason } = suppressBodySchema.parse(req.body);

      const finding = await complianceService.suppressComplianceFinding(
        id,
        { suppressedUntil: new Date(suppressedUntil), suppressedReason },
        orgId!
      );
      res.json(finding);
    })
  );

  app.delete(
    "/api/compliance/findings/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      // LR-3.5 / AUD-1 (Task #208): soft-archive. Pass the
      // authenticated user as `archivedBy` so the audit view shows
      // who removed the finding.
      const authReq = authenticatedRequest(req);
      const archivedBy = authReq.user?.id ?? (req.headers["x-user-id"] as string | undefined);
      await complianceService.deleteComplianceFinding(id, orgId!, archivedBy);
      res.status(204).send();
    })
  );

  app.get(
    "/api/compliance/rules",
    withErrorHandling("get compliance rules", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const raw = rulesFiltersSchema.parse(req.query);
      const filters = {
        sourceType: raw.sourceType,
        category: raw.category,
        enabled: raw.enabled === "true" ? true : raw.enabled === "false" ? false : undefined,
      };

      const rules = await complianceService.getComplianceRules(orgId!, filters);
      res.json(rules);
    })
  );

  app.get(
    "/api/compliance/rules/:id",
    withErrorHandling("get compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const rule = await complianceService.getComplianceRuleById(id, orgId!);

      if (!rule) {
        return sendNotFound(res, "Compliance rule");
      }

      res.json(rule);
    })
  );

  app.post(
    "/api/compliance/rules",
    writeOperationRateLimit,
    withErrorHandling("create compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const body = createRuleSchema.parse(req.body);
      const rule = await complianceService.createComplianceRule({
        ...body,
        orgId,
      } as Parameters<typeof complianceService.createComplianceRule>[0]);
      res.status(201).json(rule);
    })
  );

  app.patch(
    "/api/compliance/rules/:id",
    writeOperationRateLimit,
    withErrorHandling("update compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const body = updateRuleSchema.parse(req.body);
      const rule = await complianceService.updateComplianceRule(
        id,
        body as Parameters<typeof complianceService.updateComplianceRule>[1],
        orgId!
      );
      res.json(rule);
    })
  );

  app.delete(
    "/api/compliance/rules/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await complianceService.deleteComplianceRule(id, orgId!);
      res.status(204).send();
    })
  );

  app.post(
    "/api/compliance/check",
    writeOperationRateLimit,
    withErrorHandling("run compliance check", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, logDate, logType } = complianceCheckBodySchema.parse(req.body);

      const { complianceRulesEngine } = await import("../../../services/compliance-rules-engine");

      const result = await complianceRulesEngine.runComplianceCheck({
        orgId,
        vesselId,
        logDate,
        logType,
      });

      res.json({
        checked: true,
        vesselId,
        logDate,
        logType,
        newFindingsCount: result.newFindings.length,
        autoResolvedCount: result.autoResolved.length,
        stillOpenCount: result.stillOpen.length,
        newFindings: result.newFindings,
        autoResolved: result.autoResolved,
        stillOpen: result.stillOpen,
      });
    })
  );

  app.post(
    "/api/compliance/rules/seed",
    writeOperationRateLimit,
    withErrorHandling("seed compliance rules", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { complianceRulesEngine } = await import("../../../services/compliance-rules-engine");

      await complianceRulesEngine.seedDefaultRules(orgId);
      res.json({ success: true, message: "Default compliance rules seeded" });
    })
  );

  app.get(
    "/api/compliance/summary/:vesselId",
    withErrorHandling("get compliance summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = vesselIdParamSchema.parse(req.params);

      const summary = await complianceService.getVesselFindingsSummary(orgId!, vesselId);
      res.json(summary);
    })
  );

  // ===== STCW COMPLIANCE DASHBOARD ROUTES =====

  app.get(
    "/api/dashboard/stcw-summary",
    withErrorHandling("fetch fleet STCW summary", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { days: lookbackDays } = stcwSummaryQuerySchema.parse(req.query);

      const { getFleetSTCWSummary } = await import("../../../scheduler/stcw-dashboard");
      const summary = await getFleetSTCWSummary(orgId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get(
    "/api/dashboard/stcw-summary/vessel/:vesselId",
    withErrorHandling("fetch vessel STCW summary", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { vesselId } = vesselIdParamSchema.parse(req.params);
      const { days: lookbackDays } = stcwSummaryQuerySchema.parse(req.query);

      const { getVesselSTCWSummary } = await import("../../../scheduler/stcw-dashboard");
      const summary = await getVesselSTCWSummary(orgId, vesselId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get(
    "/api/dashboard/stcw-trends",
    withErrorHandling("fetch STCW trends", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { days: lookbackDays, vesselId } = stcwTrendsQuerySchema.parse(req.query);

      const { getSTCWComplianceTrends } = await import("../../../scheduler/stcw-dashboard");
      const trends = await getSTCWComplianceTrends(orgId, lookbackDays, vesselId);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(trends);
    })
  );

  logger.info("ComplianceRoutes", "Registered (findings: 7, rules: 6, dashboard: 3)");
}
