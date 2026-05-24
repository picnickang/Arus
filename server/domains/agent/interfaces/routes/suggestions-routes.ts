import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { agentRepo } from "../../infrastructure/repository";
import type { SuggestionEngine } from "../../application/suggestion-engine";
import type { OutcomeTrackingService } from "../../application/outcome-service";
import { OUTCOME_CATEGORIES } from "../../domain/ports";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface SuggestionsRouteDeps {
  suggestionEngine: SuggestionEngine;
  outcomeService: OutcomeTrackingService;
  rateLimit: RateLimitMiddleware;
  requireAdminRole: RoleMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

const idParamSchema = z.object({ id: z.string().min(1) });
const createSuggestionBodySchema = z.object({
  triggerType: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  context: z.record(z.unknown()).nullable().optional(),
});
const listSuggestionsQuerySchema = z.object({
  status: z.string().optional(),
  triggerType: z.string().optional(),
});
const generateBodySchema = z
  .object({ preferences: z.record(z.unknown()).optional() })
  .partial();
const updateSuggestionBodySchema = z.object({
  status: z.string().optional(),
  actedOn: z.unknown().optional(),
});
const outcomeBodySchema = z
  .object({
    outcome: z.string().optional(),
    outcomeReason: z.string().optional(),
  })
  .partial();
const effectivenessQuerySchema = z.object({
  days: z.coerce.number().int().positive().optional(),
});
const preferencesBodySchema = z.object({
  maintenance: z.boolean().optional(),
  predictions: z.boolean().optional(),
  crew: z.boolean().optional(),
  inventory: z.boolean().optional(),
  alerts: z.boolean().optional(),
  minSeverity: z.enum(["info", "warning", "critical"]).optional(),
});

export function registerSuggestionsRoutes(app: Express, deps: SuggestionsRouteDeps) {
  const { suggestionEngine, outcomeService, rateLimit, requireAdminRole, requireMaintenanceRole } =
    deps;

  app.post(
    "/api/agent/suggestions",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const parsed = createSuggestionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "triggerType, title, and summary are required" });
        }
        const { triggerType, title, summary, severity, entityType, entityId, context } =
          parsed.data;
        const sev = severity || "info";
        const suggestion = await agentRepo.suggestions.create({
          orgId,
          triggerType,
          title,
          summary,
          severity: sev,
          status: "pending",
          entityType: entityType || null,
          entityId: entityId || null,
          context: (context ?? null) as Parameters<typeof agentRepo.suggestions.create>[0]["context"],
        });
        return res.status(201).json(suggestion);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestions",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { status, triggerType } = listSuggestionsQuerySchema.parse(req.query);
        let suggestions = await agentRepo.suggestions.list(orgId, status);
        if (triggerType) {
          suggestions = suggestions.filter((s) => s.triggerType === triggerType);
        }
        return res.json(suggestions);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestions/unread-count",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const pending = await agentRepo.suggestions.list(orgId, "pending");
        return res.json({ count: pending.length });
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/suggestions/generate",
    rateLimit.writeOperationRateLimit,
    requireAdminRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { preferences } = generateBodySchema.parse(req.body ?? {});
        const newSuggestions = await suggestionEngine.generateProactiveSuggestions(
          orgId,
          preferences as Parameters<typeof suggestionEngine.generateProactiveSuggestions>[1]
        );

        try {
          const { getWebSocketServer } = await import("../../../../db/equipment/websocket");
          const ws = getWebSocketServer();
          if (ws && newSuggestions.length > 0) {
            ws.broadcast?.("suggestions", {
              type: "suggestions_new",
              data: newSuggestions,
              count: newSuggestions.length,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {}

        return res.json({ generated: newSuggestions.length, suggestions: newSuggestions });
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.put(
    "/api/agent/suggestions/:id",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { id } = idParamSchema.parse(req.params);
        const body = updateSuggestionBodySchema.parse(req.body);
        const existing = await agentRepo.suggestions.list(orgId, undefined, 1000);
        const match = existing.find((s) => s.id === id);
        if (!match) {
          return res
            .status(404)
            .json({ error: "Suggestion not found or does not belong to this organization" });
        }
        const allowedUpdates: Record<string, unknown> = {};
        if (body.status) {
          allowedUpdates.status = body.status;
        }
        if (body.actedOn !== undefined) {
          allowedUpdates.actedOn = body.actedOn;
        }
        const suggestion = await agentRepo.suggestions.update(
          id,
          allowedUpdates as Parameters<typeof agentRepo.suggestions.update>[1]
        );
        return res.json(suggestion);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/suggestions/:id/dismiss",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id || "unknown";
        const { id } = idParamSchema.parse(req.params);
        const { outcome, outcomeReason } = outcomeBodySchema.parse(req.body ?? {});
        if (outcome && !OUTCOME_CATEGORIES.includes(outcome as (typeof OUTCOME_CATEGORIES)[number])) {
          return res
            .status(400)
            .json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
        }
        const suggestion = await outcomeService.recordOutcome(
          {
            suggestionId: id,
            orgId,
            outcome: (outcome ?? null) as Parameters<typeof outcomeService.recordOutcome>[0]["outcome"],
            outcomeReason: outcomeReason || null,
            outcomeBy: userId,
          },
          "dismissed"
        );
        return res.json(suggestion);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/suggestions/:id/act",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id || "unknown";
        const { id } = idParamSchema.parse(req.params);
        const { outcome, outcomeReason } = outcomeBodySchema.parse(req.body ?? {});
        if (outcome && !OUTCOME_CATEGORIES.includes(outcome as (typeof OUTCOME_CATEGORIES)[number])) {
          return res
            .status(400)
            .json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
        }
        const suggestion = await outcomeService.recordOutcome(
          {
            suggestionId: id,
            orgId,
            outcome: (outcome ?? null) as Parameters<typeof outcomeService.recordOutcome>[0]["outcome"],
            outcomeReason: outcomeReason || null,
            outcomeBy: userId,
          },
          "acted"
        );
        return res.json(suggestion);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/suggestions/:id/defer",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id || "unknown";
        const { id } = idParamSchema.parse(req.params);
        const { outcome, outcomeReason } = outcomeBodySchema.parse(req.body ?? {});
        if (outcome && !OUTCOME_CATEGORIES.includes(outcome as (typeof OUTCOME_CATEGORIES)[number])) {
          return res
            .status(400)
            .json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
        }
        const suggestion = await outcomeService.recordOutcome(
          {
            suggestionId: id,
            orgId,
            outcome: (outcome ?? null) as Parameters<typeof outcomeService.recordOutcome>[0]["outcome"],
            outcomeReason: outcomeReason || null,
            outcomeBy: userId,
          },
          "deferred"
        );
        return res.json(suggestion);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestions/effectiveness",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { days } = effectivenessQuerySchema.parse(req.query);
        const summary = await outcomeService.getEffectiveness(orgId, Math.min(days ?? 30, 365));
        return res.json(summary);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestions/history",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const all = await agentRepo.suggestions.list(orgId, undefined, 200);
        const history = all.filter((s) => s.status !== "pending");
        return res.json(history);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestion-preferences",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const prefs = await agentRepo.suggestions.getPreferences(orgId, userId);
        return res.json(
          prefs || {
            maintenance: true,
            predictions: true,
            crew: true,
            inventory: true,
            alerts: true,
            minSeverity: "info",
          }
        );
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.put(
    "/api/agent/suggestion-preferences",
    rateLimit.writeOperationRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const parsed = preferencesBodySchema.parse(req.body);
        const prefs = await agentRepo.suggestions.savePreferences(orgId, parsed, userId);
        return res.json(prefs);
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid preferences", details: error.errors });
        }
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
