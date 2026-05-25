import type { Express, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { validateResponse } from "../../../../lib/api-helpers";
import { withErrorHandling } from "../../../../lib/route-utils";
import type { AttentionWorkflowSources } from "../../domain/ports.js";
import {
  AttentionWorkflowService,
  createAttentionWorkflowService,
} from "../../application/attention-service.js";
import { OperatorExperienceService } from "../application/operator-experience.service.js";
import { AttentionWorkflowSignalsAdapter } from "../infrastructure/attention-signals.adapter.js";
import { FileOperatorExperienceEventStore } from "../infrastructure/file-event-store.adapter.js";
import { StaticOperatorRoleProfileAdapter } from "../infrastructure/static-role-profile.adapter.js";
import { RoleInformationNeedsService } from "../information-needs/application/role-information-needs.service.js";
import { StaticRoleInformationCatalogAdapter } from "../information-needs/infrastructure/static-role-information-catalog.adapter.js";
import { createRoleInformationNeedsRouter } from "../information-needs/interfaces/routes.js";

const roleSchema = z.enum([
  "chief_engineer",
  "second_engineer",
  "deck_officer",
  "technician",
  "fleet_manager",
  "superintendent",
  "system_admin",
]);

const deviceClassSchema = z.enum(["mobile", "tablet", "desktop", "unknown"]);
const connectionStateSchema = z.enum(["online", "offline", "degraded", "unknown"]);
const eventTypeSchema = z.enum([
  "page_view",
  "cta_click",
  "workflow_started",
  "workflow_completed",
  "friction_reported",
  "trust_signal_viewed",
]);

const roleProfileSchema = z.object({
  role: roleSchema,
  label: z.string(),
  primaryGoal: z.string(),
  dailyQuestions: z.array(z.string()),
  successDefinition: z.string(),
  preferredPrimaryAction: z.string(),
});

const signalSnapshotSchema = z.object({
  attentionItems: z.number().int().nonnegative(),
  criticalItems: z.number().int().nonnegative(),
  blockedItems: z.number().int().nonnegative(),
  waitingOnParts: z.number().int().nonnegative(),
  readyForCloseout: z.number().int().nonnegative(),
  handoverNotes: z.number().int().nonnegative(),
  offlinePending: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
  pdmRisks: z.number().int().nonnegative(),
  dataQualityWarnings: z.number().int().nonnegative(),
  lastSyncAt: z.string().nullable().optional(),
  sourceHealth: z.record(z.enum(["ok", "failed", "not_configured"])),
});

const pillarScoreSchema = z.object({
  pillar: z.enum(["clarity", "trust", "actionability", "speed", "offline_resilience", "learning_loop"]),
  label: z.string(),
  score: z.number().min(0).max(100),
  severity: z.enum(["good", "watch", "risk", "critical"]),
  reason: z.string(),
  recommendedImprovement: z.string(),
});

const nextActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  href: z.string(),
  priority: z.enum(["routine", "soon", "urgent", "immediate"]),
  businessImpact: z.enum(["trust", "conversion", "retention", "safety", "uptime"]),
});

const frictionPointSchema = z.object({
  id: z.string(),
  title: z.string(),
  symptom: z.string(),
  affectedGoal: z.string(),
  fix: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

const trustSignalSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  status: z.enum(["present", "needs_attention", "missing"]),
  evidence: z.string(),
});

const solutionMapSchema = z.object({
  detectRisk: z.string(),
  explainRisk: z.string(),
  assignAction: z.string(),
  completeWork: z.string(),
  captureProof: z.string(),
  updateHandover: z.string(),
  learnFromOutcome: z.string(),
  reportImpact: z.string(),
});

const operatorExperienceBriefSchema = z.object({
  generatedAt: z.string(),
  orgId: z.string(),
  role: roleProfileSchema,
  currentPath: z.string().optional(),
  statedGoal: z.string().optional(),
  executiveSummary: z.string(),
  userQuestionsAnswered: z.array(z.object({ question: z.string(), answer: z.string() })),
  signals: signalSnapshotSchema,
  pillarScores: z.array(pillarScoreSchema),
  nextActions: z.array(nextActionSchema),
  frictionPoints: z.array(frictionPointSchema),
  trustSignals: z.array(trustSignalSchema),
  solutionMap: solutionMapSchema,
  successMetric: z.string(),
});

const eventSchema = z.object({
  eventType: eventTypeSchema,
  role: roleSchema.optional(),
  path: z.string().max(300).optional(),
  label: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().optional(),
});

const recordedEventSchema = eventSchema.extend({
  id: z.string(),
  orgId: z.string(),
  occurredAt: z.string(),
});

const briefQuerySchema = z.object({
  role: roleSchema.default("chief_engineer"),
  currentPath: z.string().max(300).optional(),
  deviceClass: deviceClassSchema.default("unknown"),
  connectionState: connectionStateSchema.default("unknown"),
  statedGoal: z.string().max(300).optional(),
});

function getOrgId(req: Request): string {
  return (req as { orgId?: string }).orgId || DEFAULT_ORG_ID;
}

export function createOperatorExperienceRouter(service: OperatorExperienceService): Router {
  const router = Router();

  router.get(
    "/brief",
    withErrorHandling("get operator experience brief", async (req: Request, res: Response) => {
      const query = briefQuerySchema.parse(req.query);
      const brief = await service.buildBrief(getOrgId(req), query);
      res.json(validateResponse(operatorExperienceBriefSchema, brief, "GET /api/operator-experience/brief"));
    })
  );

  router.get(
    "/roles",
    withErrorHandling("list operator experience roles", async (_req: Request, res: Response) => {
      res.json(validateResponse(z.array(roleProfileSchema), service.listRoleProfiles(), "GET /api/operator-experience/roles"));
    })
  );

  router.get(
    "/solution-map",
    withErrorHandling("get operator experience solution map", async (_req: Request, res: Response) => {
      res.json(validateResponse(solutionMapSchema, service.solutionMap(), "GET /api/operator-experience/solution-map"));
    })
  );

  router.get(
    "/events",
    withErrorHandling("list operator experience events", async (req: Request, res: Response) => {
      const limit = Math.max(1, Math.min(Number(req.query['limit'] ?? 25), 100));
      const events = await service.listRecentEvents(getOrgId(req), limit);
      res.json(validateResponse(z.array(recordedEventSchema), events, "GET /api/operator-experience/events"));
    })
  );

  router.post(
    "/events",
    withErrorHandling("record operator experience event", async (req: Request, res: Response) => {
      const event = eventSchema.parse(req.body);
      const record = await service.recordEvent(getOrgId(req), event);
      res.status(201).json(validateResponse(recordedEventSchema, record, "POST /api/operator-experience/events"));
    })
  );

  return router;
}

export function createOperatorExperienceService(attentionService: AttentionWorkflowService): OperatorExperienceService {
  return new OperatorExperienceService(
    new AttentionWorkflowSignalsAdapter(attentionService),
    new StaticOperatorRoleProfileAdapter(),
    new FileOperatorExperienceEventStore()
  );
}

export function createRoleInformationNeedsService(attentionService: AttentionWorkflowService): RoleInformationNeedsService {
  return new RoleInformationNeedsService(
    new StaticRoleInformationCatalogAdapter(),
    new AttentionWorkflowSignalsAdapter(attentionService)
  );
}

export function registerOperatorExperienceRoutes(
  app: Express,
  deps: {
    generalApiRateLimit: import("express").RequestHandler;
    writeOperationRateLimit?: import("express").RequestHandler;
    requireOrgId: import("express").RequestHandler;
    sources: AttentionWorkflowSources;
  }
) {
  const attentionService = createAttentionWorkflowService(deps.sources);
  const service = createOperatorExperienceService(attentionService);
  const informationNeedsService = createRoleInformationNeedsService(attentionService);
  const router = createOperatorExperienceRouter(service);
  router.use("/information-needs", createRoleInformationNeedsRouter(informationNeedsService));

  app.use(
    "/api/operator-experience",
    deps.generalApiRateLimit,
    deps.requireOrgId,
    router
  );
}
