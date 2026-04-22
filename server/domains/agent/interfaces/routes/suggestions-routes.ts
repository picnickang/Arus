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
        const { triggerType, title, summary, severity, entityType, entityId, context } = req.body;
        if (!triggerType || !title || !summary) {
          return res.status(400).json({ error: "triggerType, title, and summary are required" });
        }
        const validSeverities = ["info", "warning", "critical"];
        const sev = severity || "info";
        if (!validSeverities.includes(sev)) {
          return res
            .status(400)
            .json({ error: `Invalid severity. Valid: ${validSeverities.join(", ")}` });
        }
        const suggestion = await agentRepo.suggestions.create({
          orgId,
          triggerType,
          title,
          summary,
          severity: sev,
          status: "pending",
          entityType: entityType || null,
          entityId: entityId || null,
          context: context || null,
        });
        res.status(201).json(suggestion);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestions",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const status = req.query.status as string | undefined;
        const triggerType = req.query.triggerType as string | undefined;
        let suggestions = await agentRepo.suggestions.list(orgId, status);
        if (triggerType) {
          suggestions = suggestions.filter((s) => s.triggerType === triggerType);
        }
        res.json(suggestions);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        res.json({ count: pending.length });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const preferences = req.body.preferences || undefined;
        const newSuggestions = await suggestionEngine.generateProactiveSuggestions(
          orgId,
          preferences
        );

        try {
          const { getWebSocketServer } = await import("../../../../db/equipment/websocket");
          const ws = getWebSocketServer();
          if (ws && newSuggestions.length > 0) {
            ws.broadcast("suggestions", {
              type: "suggestions_new",
              data: newSuggestions,
              count: newSuggestions.length,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {}

        res.json({ generated: newSuggestions.length, suggestions: newSuggestions });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const existing = await agentRepo.suggestions.list(orgId, undefined, 1000);
        const match = existing.find((s) => s.id === req.params.id);
        if (!match) {
          return res
            .status(404)
            .json({ error: "Suggestion not found or does not belong to this organization" });
        }
        const allowedUpdates: Record<string, unknown> = {};
        if (req.body.status) {
          allowedUpdates.status = req.body.status;
        }
        if (req.body.actedOn !== undefined) {
          allowedUpdates.actedOn = req.body.actedOn;
        }
        const suggestion = await agentRepo.suggestions.update(req.params.id, allowedUpdates);
        res.json(suggestion);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { outcome, outcomeReason } = req.body || {};
        if (outcome && !OUTCOME_CATEGORIES.includes(outcome)) {
          return res
            .status(400)
            .json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
        }
        const suggestion = await outcomeService.recordOutcome(
          {
            suggestionId: req.params.id,
            orgId,
            outcome: outcome || null,
            outcomeReason: outcomeReason || null,
            outcomeBy: userId,
          },
          "dismissed"
        );
        res.json(suggestion);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { outcome, outcomeReason } = req.body || {};
        if (outcome && !OUTCOME_CATEGORIES.includes(outcome)) {
          return res
            .status(400)
            .json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
        }
        const suggestion = await outcomeService.recordOutcome(
          {
            suggestionId: req.params.id,
            orgId,
            outcome: outcome || null,
            outcomeReason: outcomeReason || null,
            outcomeBy: userId,
          },
          "acted"
        );
        res.json(suggestion);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const { outcome, outcomeReason } = req.body || {};
        if (outcome && !OUTCOME_CATEGORIES.includes(outcome)) {
          return res
            .status(400)
            .json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
        }
        const suggestion = await outcomeService.recordOutcome(
          {
            suggestionId: req.params.id,
            orgId,
            outcome: outcome || null,
            outcomeReason: outcomeReason || null,
            outcomeBy: userId,
          },
          "deferred"
        );
        res.json(suggestion);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/suggestions/effectiveness",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const days = parseInt(req.query.days as string) || 30;
        const summary = await outcomeService.getEffectiveness(orgId, Math.min(days, 365));
        res.json(summary);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        res.json(history);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        res.json(
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
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
        const schema = z.object({
          maintenance: z.boolean().optional(),
          predictions: z.boolean().optional(),
          crew: z.boolean().optional(),
          inventory: z.boolean().optional(),
          alerts: z.boolean().optional(),
          minSeverity: z.enum(["info", "warning", "critical"]).optional(),
        });
        const parsed = schema.parse(req.body);
        const prefs = await agentRepo.suggestions.savePreferences(orgId, parsed, userId);
        res.json(prefs);
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Invalid preferences", details: error.errors });
        }
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
