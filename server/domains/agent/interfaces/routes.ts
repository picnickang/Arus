import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AgentOrchestrator } from "../application/orchestrator";
import { SafetyService } from "../application/safety-service";
import { SuggestionEngine } from "../application/suggestion-engine";
import { SchedulerService } from "../application/scheduler-service";
import { agentRepo } from "../infrastructure/repository";
import { getToolSummaries, getRegisteredToolNames } from "../tools";
import { getReportArtifact } from "../tools/enhanced-report-tools";
import { executeDraftAction } from "../application/draft-executor";
import { MAINTENANCE_ROLES } from "../domain/types";
import { storage } from "../../../storage";
import { db } from "../../../db";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { auditAction } from "../../../utils/audit-helpers";
import { z } from "zod";

import { getOrgUploadDir, registerFile, listConversationFiles } from "../infrastructure/file-registry";
import { knowledgeBaseAdapter } from "../infrastructure/kb-adapter";
import { ingestFilesToKB, buildIngestionSystemMessage } from "../infrastructure/kb-ingestion-helper";
import { buildSystemPrompt } from "../domain/system-prompt";
import { createFindingsAdapter } from "../infrastructure/findings-adapter";
import { FindingsAggregatorService } from "../application/findings-service";
import type { FindingsFilter, FindingsPagination } from "../domain/findings-types";
import { OutcomeTrackingService } from "../application/outcome-service";
import { OUTCOME_CATEGORIES } from "../domain/ports";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const orgId = (req as AuthenticatedRequest).orgId || "default-org-id";
      cb(null, getOrgUploadDir(orgId));
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "image/png", "image/jpeg",
      "application/pdf", "text/csv", "text/plain", "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = /\.(pdf|csv|txt|md|docx|xlsx|png|jpe?g)$/i;
    const mimeOk = allowedMimes.includes(file.mimetype) || file.mimetype === "application/octet-stream";
    const extOk = allowedExtensions.test(file.originalname);
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      console.warn(`[Agent] Rejected upload: "${file.originalname}" (MIME: ${file.mimetype}, ext match: ${extOk}, mime match: ${mimeOk})`);
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PNG, JPEG, PDF, CSV, TXT, MD, DOCX, XLSX.`));
    }
  },
});

interface RateLimitMiddleware {
  generalApiRateLimit: (req: Request, res: Response, next: () => void) => void;
  writeOperationRateLimit: (req: Request, res: Response, next: () => void) => void;
}

export function registerAgentRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const orchestrator = new AgentOrchestrator(agentRepo, knowledgeBaseAdapter);
  const safety = new SafetyService(agentRepo);
  const suggestionEngine = new SuggestionEngine(agentRepo);

  suggestionEngine.setSignalHandler(async (signal) => {
    await orchestrator.processSignal(signal);
  });

  (async () => {
    try {
      const { organizations } = await import("@shared/schema/core");
      const orgs = await db.select({ id: organizations.id }).from(organizations);
      for (const org of orgs) {
        suggestionEngine.startBackgroundEvaluation(org.id);
      }
      if (orgs.length === 0) {
        suggestionEngine.startBackgroundEvaluation("default-org-id");
      }
    } catch {
      suggestionEngine.startBackgroundEvaluation("default-org-id");
    }
  })();

  const requireAdminRole = (req: Request, res: Response, next: () => void) => {
    const user = (req as AuthenticatedRequest).user;
    const role = user?.role?.toLowerCase();
    if (!role || role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  const requireMaintenanceRole = (req: Request, res: Response, next: () => void) => {
    const user = (req as AuthenticatedRequest).user;
    const role = user?.role?.toLowerCase();
    if (!role || !MAINTENANCE_ROLES.includes(role as typeof MAINTENANCE_ROLES[number])) {
      return res.status(403).json({ error: "Maintenance role required" });
    }
    next();
  };

  app.post("/api/agent/chat", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const userRole = (req as AuthenticatedRequest).user?.role;
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const result = await orchestrator.run(orgId, userId, conversationId, message, userRole);

      await auditAction("agent_conversation", result.conversationId, "update", {
        action: "chat",
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      }, { orgId, userId });

      res.json({
        conversationId: result.conversationId,
        response: result.finalResponse,
        toolCalls: result.toolCalls,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      });
    } catch (error: unknown) {
      console.error("[Agent] Chat error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Agent error" });
    }
  });

  app.post("/api/agent/chat-multimodal", rateLimit.writeOperationRateLimit, upload.array("files", 5), async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const userRole = (req as AuthenticatedRequest).user?.role;
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const attachments = files.map(f => ({
        filename: f.originalname,
        mimetype: f.mimetype,
        path: f.path,
        size: f.size,
      }));

      const result = await orchestrator.runWithAttachments(orgId, userId, conversationId, message, attachments, userRole);

      const convFiles = await listConversationFiles(result.conversationId, orgId);
      const fileRefs = convFiles.map(f => ({
        fileId: f.id, filename: f.filename, mimetype: f.mimetype, size: f.size,
      }));

      res.json({
        conversationId: result.conversationId,
        response: result.finalResponse,
        toolCalls: result.toolCalls,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
        files: fileRefs,
      });
    } catch (error: unknown) {
      console.error("[Agent] Multimodal chat error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Agent error" });
    }
  });

  app.post("/api/agent/conversations/:id/files", rateLimit.writeOperationRateLimit, upload.array("files", 5), async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const conversationId = req.params.id;

      const existing = await agentRepo.conversations.get(conversationId, orgId);
      if (!existing) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const fileRefs = await Promise.all(files.map(async f => {
        const record = await registerFile(orgId, conversationId, f);
        return {
          fileId: record.id,
          filename: record.filename,
          mimetype: record.mimetype,
          size: record.size,
          originalname: f.originalname,
          path: f.path,
        };
      }));

      const kbFiles = fileRefs.map(f => ({
        path: f.path,
        filename: f.originalname,
        mimetype: f.mimetype,
      }));
      const kbResults = await ingestFilesToKB(knowledgeBaseAdapter, orgId, kbFiles, userId);

      const kbIngestedSet = new Set(kbResults.map(r => r.filename));

      if (kbResults.length > 0) {
        try {
          const systemContent = buildIngestionSystemMessage(kbResults);
          await agentRepo.messages.create({
            conversationId,
            role: "system",
            content: systemContent,
          });
        } catch (err) {
          console.warn("[Agent] Failed to create KB ingestion system message:", err instanceof Error ? err.message : "unknown");
        }
      }

      res.json({
        files: fileRefs.map(f => ({
          fileId: f.fileId,
          filename: f.filename,
          mimetype: f.mimetype,
          size: f.size,
          kbIngested: kbIngestedSet.has(f.originalname),
        })),
      });
    } catch (error: unknown) {
      console.error("[Agent] File upload error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
    }
  });

  app.get("/api/agent/conversations/:id/files", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversationId = req.params.id;
      const files = await listConversationFiles(conversationId, orgId);
      res.json({ files: files.map(f => ({ fileId: f.id, filename: f.filename, mimetype: f.mimetype, size: f.size })) });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list files" });
    }
  });

  app.get("/api/agent/chat-stream", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const userRole = (req as AuthenticatedRequest).user?.role;
      const message = req.query.message as string;
      const conversationId = req.query.conversationId as string | undefined;

      if (!message) {
        return res.status(400).json({ error: "Message query parameter is required" });
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      await orchestrator.runStream(orgId, userId, conversationId, message, (chunk) => {
        res.write(`data: ${chunk}\n\n`);
      }, userRole);

      res.end();
    } catch (error: unknown) {
      console.error("[Agent] Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Agent stream error" });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Unknown error" })}\n\n`);
        res.end();
      }
    }
  });

  app.get("/api/agent/conversations", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const conversations = await agentRepo.conversations.list(orgId, userId);
      res.json(conversations);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/conversations/:id", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepo.conversations.get(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      res.json(conversation);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/conversations/:id/messages", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepo.conversations.get(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      const messages = await agentRepo.messages.list(req.params.id);
      const toolCalls = await agentRepo.toolCalls.list(req.params.id);
      res.json({ messages, toolCalls });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/agent/conversations/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepo.conversations.get(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      await agentRepo.conversations.delete(req.params.id);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/drafts", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const status = req.query.status as string | undefined;
      const drafts = await agentRepo.drafts.list(orgId, status);
      res.json(drafts);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/drafts/:id/approve", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const draft = await agentRepo.drafts.get(req.params.id, orgId);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status !== "pending") return res.status(400).json({ error: "Draft is not pending" });

      const execResult = await executeDraftAction(
        draft.draftType,
        draft.data as Record<string, unknown>,
        orgId
      );

      if (execResult.error) {
        const statusCode = execResult.error.includes("Access denied") ? 403 : 
                          execResult.error.includes("not found") ? 404 : 502;
        return res.status(statusCode).json({
          error: execResult.error,
          details: execResult.partialFailures,
        });
      }

      if (execResult.partialFailures && execResult.partialFailures.length > 0) {
        console.warn(`[Agent] Draft execution partial failure:`, execResult.partialFailures);
      }

      const resultId = execResult.resultId;

      const updated = await agentRepo.drafts.update(draft.id, {
        status: "approved",
        reviewedById: userId,
        reviewNote: req.body.note,
        resultId,
      });

      await agentRepo.approvals.create({
        orgId,
        draftId: draft.id,
        conversationId: draft.conversationId,
        action: "approved",
        reviewedById: userId,
        reviewNote: req.body.note,
        resultId,
      });

      await auditAction("agent_draft", draft.id, "update", {
        action: "approved",
        draftType: draft.draftType,
        reviewedBy: userId,
        resultId,
      }, { orgId, userId });

      res.json({ draft: updated, resultId });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/drafts/:id/reject", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const draft = await agentRepo.drafts.get(req.params.id, orgId);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status !== "pending") return res.status(400).json({ error: "Draft is not pending" });

      const updated = await agentRepo.drafts.update(draft.id, {
        status: "rejected",
        reviewedById: userId,
        reviewNote: req.body.note,
      });

      await agentRepo.approvals.create({
        orgId,
        draftId: draft.id,
        conversationId: draft.conversationId,
        action: "rejected",
        reviewedById: userId,
        reviewNote: req.body.note,
      });

      await auditAction("agent_draft", draft.id, "update", {
        action: "rejected",
        draftType: draft.draftType,
        reviewedBy: userId,
      }, { orgId, userId });

      res.json(updated);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/config", rateLimit.generalApiRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const config = await agentRepo.config.get(orgId);
      res.json(config || { defaultModel: "gpt-4o-mini", maxIterationsPerRun: 10, maxTokensPerConversation: 50000, dailyTokenLimit: 500000, monthlyTokenLimit: 5000000, contextCompaction: true, compactionThreshold: 30, toolOutputCharLimit: 4000, deferredToolLoading: true, permissionTier: "strict", autoTriggerEnabled: false, autoTriggerThreshold: 0.85 });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  const configUpdateSchema = z.object({
    defaultModel: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]).optional(),
    maxIterationsPerRun: z.number().int().min(1).max(50).optional(),
    maxTokensPerConversation: z.number().int().min(1000).max(500000).optional(),
    dailyTokenLimit: z.number().int().min(10000).max(50000000).optional(),
    monthlyTokenLimit: z.number().int().min(100000).max(500000000).optional(),
    customSystemPrompt: z.string().max(5000).optional().nullable(),
    enabledTools: z.array(z.string()).optional().nullable(),
    contextCompaction: z.boolean().optional(),
    compactionThreshold: z.number().int().min(5).max(100).optional(),
    toolOutputCharLimit: z.number().int().min(500).max(50000).optional(),
    deferredToolLoading: z.boolean().optional(),
    permissionTier: z.enum(["strict", "balanced", "autonomous"]).optional(),
    autoTriggerEnabled: z.boolean().optional(),
    autoTriggerThreshold: z.number().min(0.8).max(1.0).optional(),
  });

  app.put("/api/agent/config", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parsed = configUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid configuration", details: parsed.error.flatten().fieldErrors });
      }

      if (parsed.data.enabledTools && Array.isArray(parsed.data.enabledTools) && parsed.data.enabledTools.length > 0) {
        const registeredNames = getRegisteredToolNames();
        const invalid = parsed.data.enabledTools.filter(t => !registeredNames.includes(t));
        if (invalid.length > 0) {
          return res.status(400).json({ error: "Invalid tool names in enabledTools", invalidTools: invalid, validTools: registeredNames });
        }
      }

      const config = await agentRepo.config.upsert({ ...parsed.data, orgId });

      await auditAction("agent_config", config.id, "update", {
        action: "config_updated",
        fields: Object.keys(parsed.data),
      }, { orgId, userId: (req as AuthenticatedRequest).user?.id });

      res.json(config);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/agent/config", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const defaults = {
        orgId,
        defaultModel: "gpt-4o-mini",
        maxIterationsPerRun: 10,
        maxTokensPerConversation: 50000,
        dailyTokenLimit: 500000,
        monthlyTokenLimit: 5000000,
        customSystemPrompt: null,
        enabledTools: null,
        contextCompaction: true,
        compactionThreshold: 30,
        toolOutputCharLimit: 4000,
        deferredToolLoading: true,
        permissionTier: "strict",
        autoTriggerEnabled: false,
        autoTriggerThreshold: 0.85,
      };
      const config = await agentRepo.config.upsert(defaults);
      res.json(config);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/usage", rateLimit.generalApiRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const days = parseInt(req.query.days as string) || 30;
      const stats = await safety.getUsageStats(orgId, days);
      res.json(stats);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/suggestions", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { triggerType, title, summary, severity, entityType, entityId, context } = req.body;
      if (!triggerType || !title || !summary) {
        return res.status(400).json({ error: "triggerType, title, and summary are required" });
      }
      const validSeverities = ["info", "warning", "critical"];
      const sev = severity || "info";
      if (!validSeverities.includes(sev)) {
        return res.status(400).json({ error: `Invalid severity. Valid: ${validSeverities.join(", ")}` });
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
  });

  app.get("/api/agent/suggestions", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const status = req.query.status as string | undefined;
      const triggerType = req.query.triggerType as string | undefined;
      let suggestions = await agentRepo.suggestions.list(orgId, status);
      if (triggerType) {
        suggestions = suggestions.filter(s => s.triggerType === triggerType);
      }
      res.json(suggestions);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/suggestions/unread-count", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const pending = await agentRepo.suggestions.list(orgId, "pending");
      res.json({ count: pending.length });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/suggestions/generate", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const preferences = req.body.preferences || undefined;
      const newSuggestions = await suggestionEngine.generateProactiveSuggestions(orgId, preferences);

      try {
        const { getWebSocketServer } = await import("../../../db/equipment/websocket");
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
  });

  app.put("/api/agent/suggestions/:id", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.suggestions.list(orgId, undefined, 1000);
      const match = existing.find(s => s.id === req.params.id);
      if (!match) return res.status(404).json({ error: "Suggestion not found or does not belong to this organization" });
      const allowedUpdates: Record<string, unknown> = {};
      if (req.body.status) allowedUpdates.status = req.body.status;
      if (req.body.actedOn !== undefined) allowedUpdates.actedOn = req.body.actedOn;
      const suggestion = await agentRepo.suggestions.update(req.params.id, allowedUpdates);
      res.json(suggestion);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  const outcomeService = new OutcomeTrackingService(agentRepo);

  app.post("/api/agent/suggestions/:id/dismiss", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id || "unknown";
      const { outcome, outcomeReason } = req.body || {};
      if (outcome && !OUTCOME_CATEGORIES.includes(outcome)) {
        return res.status(400).json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
      }
      const suggestion = await outcomeService.recordOutcome(
        { suggestionId: req.params.id, orgId, outcome: outcome || "not_relevant", outcomeReason, outcomeBy: userId },
        "dismissed",
      );
      res.json(suggestion);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/suggestions/:id/act", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id || "unknown";
      const { outcome, outcomeReason } = req.body || {};
      if (outcome && !OUTCOME_CATEGORIES.includes(outcome)) {
        return res.status(400).json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
      }
      const suggestion = await outcomeService.recordOutcome(
        { suggestionId: req.params.id, orgId, outcome: outcome || "useful", outcomeReason, outcomeBy: userId },
        "acted",
      );
      res.json(suggestion);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/suggestions/:id/defer", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id || "unknown";
      const { outcome, outcomeReason } = req.body || {};
      if (outcome && !OUTCOME_CATEGORIES.includes(outcome)) {
        return res.status(400).json({ error: `Invalid outcome. Valid: ${OUTCOME_CATEGORIES.join(", ")}` });
      }
      const suggestion = await outcomeService.recordOutcome(
        { suggestionId: req.params.id, orgId, outcome: outcome || "not_relevant", outcomeReason: outcomeReason || "Deferred for later review", outcomeBy: userId },
        "deferred",
      );
      res.json(suggestion);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/suggestions/effectiveness", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const days = parseInt(req.query.days as string) || 30;
      const summary = await outcomeService.getEffectiveness(orgId, Math.min(days, 365));
      res.json(summary);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/suggestions/history", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const all = await agentRepo.suggestions.list(orgId, undefined, 200);
      const history = all.filter(s => s.status !== "pending");
      res.json(history);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/suggestion-preferences", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const prefs = await agentRepo.suggestions.getPreferences(orgId, userId);
      res.json(prefs || {
        maintenance: true,
        predictions: true,
        crew: true,
        inventory: true,
        alerts: true,
        minSeverity: "info",
      });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/agent/suggestion-preferences", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
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
  });

  const globalScheduler = new SchedulerService(
    agentRepo,
    (org, user, conv, msg, role, opts) => orchestrator.run(org, user, conv, msg, role, opts),
  );

  app.get("/api/agent/schedules", rateLimit.generalApiRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedules = await agentRepo.schedules.list(orgId);
      res.json(schedules);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/schedules", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await agentRepo.schedules.create({ ...req.body, orgId });
      if (schedule.enabled) {
        globalScheduler.scheduleJob(schedule);
      }
      res.status(201).json(schedule);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/agent/schedules/:id", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.schedules.get(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const schedule = await agentRepo.schedules.update(req.params.id, req.body);
      if (schedule.enabled) {
        globalScheduler.scheduleJob(schedule);
      } else {
        globalScheduler.cancelJob(schedule.id);
      }
      res.json(schedule);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/agent/schedules/:id", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.schedules.get(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      globalScheduler.cancelJob(req.params.id);
      await agentRepo.schedules.delete(req.params.id);
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/schedules/:id/runs", rateLimit.generalApiRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.schedules.get(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const runs = await agentRepo.schedules.getRuns(req.params.id);
      res.json(runs);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/schedules/:id/run", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await agentRepo.schedules.get(req.params.id, orgId);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });

      await globalScheduler.executeSchedule(schedule);
      res.json({ success: true, message: "Schedule run triggered" });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/tools", rateLimit.generalApiRateLimit, requireAdminRole, async (_req: Request, res: Response) => {
    try {
      res.json(getToolSummaries());
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/admin/conversations", rateLimit.generalApiRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const limit = parseInt(req.query.limit as string) || 100;
      const conversations = await agentRepo.conversations.list(orgId, undefined, limit);
      res.json(conversations);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/admin/export-jsonl", rateLimit.generalApiRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const config = await agentRepo.config.get(orgId);
      const systemContent = buildSystemPrompt(config?.customSystemPrompt);

      const allConversations = await agentRepo.conversations.list(orgId, undefined, 10000);

      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="agent-conversations-${new Date().toISOString().slice(0, 10)}.jsonl"`);
      res.setHeader("X-Total-Conversations", String(allConversations.length));

      const CONV_LIMIT = 10000;
      const MSG_LIMIT = 500;
      if (allConversations.length >= CONV_LIMIT) {
        res.setHeader("X-Truncated", "true");
      }
      let truncatedConversations = 0;
      for (const conv of allConversations) {
        const messages = await agentRepo.messages.list(conv.id, MSG_LIMIT);
        if (messages.length === 0) continue;
        if (messages.length >= MSG_LIMIT) truncatedConversations++;

        const openaiMessages: Record<string, unknown>[] = [];
        openaiMessages.push({ role: "system", content: systemContent });

        for (const msg of messages) {
          if (msg.role === "user") {
            openaiMessages.push({ role: "user", content: msg.content || "" });
          } else if (msg.role === "assistant" && msg.toolCalls) {
            const calls = msg.toolCalls as { id: string; type: string; function: { name: string; arguments: string } }[];
            openaiMessages.push({
              role: "assistant",
              content: msg.content || null,
              tool_calls: calls,
            });
          } else if (msg.role === "assistant") {
            openaiMessages.push({ role: "assistant", content: msg.content || "" });
          } else if (msg.role === "tool") {
            const ref = msg.toolCalls as { toolCallId?: string } | null;
            openaiMessages.push({
              role: "tool",
              content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
              tool_call_id: ref?.toolCallId || "unknown",
            });
          }
        }

        if (openaiMessages.length > 1) {
          res.write(JSON.stringify({ messages: openaiMessages }) + "\n");
        }
      }

      if (truncatedConversations > 0) {
        console.log(`[Agent Export] ${truncatedConversations} conversation(s) had messages truncated at ${MSG_LIMIT}`);
      }
      res.end();
    } catch (error: unknown) {
      if (!res.headersSent) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
      } else {
        res.end();
      }
    }
  });

  app.delete("/api/agent/admin/conversations", rateLimit.writeOperationRateLimit, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversations = await agentRepo.conversations.list(orgId, undefined, 1000);
      let purged = 0;
      for (const conv of conversations) {
        await agentRepo.conversations.delete(conv.id);
        purged++;
      }

      await auditAction("agent_conversations", orgId, "delete", {
        action: "bulk_purge",
        count: purged,
      }, { orgId, userId: (req as AuthenticatedRequest).user?.id });

      res.json({ purged });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/reports/:reportId/download", async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      if (!orgId) return res.status(401).json({ error: "Authentication required" });

      const { reportId } = req.params;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(reportId)) {
        return res.status(400).json({ error: "Invalid report ID format" });
      }

      const artifact = getReportArtifact(reportId);
      if (!artifact) {
        return res.status(404).json({ error: "Report artifact not found" });
      }

      if (artifact.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(artifact.filePath)) {
        return res.status(404).json({ error: "Report file no longer available" });
      }

      const ext = path.extname(artifact.fileName).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".json": "application/json",
        ".csv": "text/csv",
        ".txt": "text/plain",
        ".pdf": "application/pdf",
      };
      res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
      const fileStream = fs.createReadStream(artifact.filePath);
      fileStream.pipe(res);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Download failed" });
    }
  });

  const findingsService = new FindingsAggregatorService(createFindingsAdapter());

  app.get("/api/agent/findings", rateLimit.generalApiRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const filter: FindingsFilter = {};

      const validSources = ["suggestion", "draft", "schedule_run"];
      const validSeverities = ["info", "warning", "critical"];
      const validStatuses = ["pending", "acted", "dismissed", "deferred", "approved", "rejected", "completed", "failed", "running"];

      if (req.query.source) {
        const src = req.query.source as string;
        if (!validSources.includes(src)) return res.status(400).json({ error: `Invalid source: ${src}` });
        filter.source = src as FindingsFilter["source"];
      }
      if (req.query.severity) {
        const sev = req.query.severity as string;
        if (!validSeverities.includes(sev)) return res.status(400).json({ error: `Invalid severity: ${sev}` });
        filter.severity = sev as FindingsFilter["severity"];
      }
      if (req.query.status) {
        const st = req.query.status as string;
        if (!validStatuses.includes(st)) return res.status(400).json({ error: `Invalid status: ${st}` });
        filter.status = st as FindingsFilter["status"];
      }
      if (req.query.dateFrom) {
        const d = new Date(req.query.dateFrom as string);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid dateFrom" });
        filter.dateFrom = req.query.dateFrom as string;
      }
      if (req.query.dateTo) {
        const d = new Date(req.query.dateTo as string);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid dateTo" });
        filter.dateTo = req.query.dateTo as string;
      }

      const rawOffset = parseInt(req.query.offset as string);
      const pagination: FindingsPagination = {
        limit: Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200),
        offset: isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset,
      };

      const result = await findingsService.getFindings(orgId, filter, pagination);
      res.json(result);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/agent/findings/summary", rateLimit.generalApiRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const summary = await findingsService.getSummary(orgId);
      res.json(summary);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  (async () => {
    try {
      const { organizations } = await import("@shared/schema/core");
      const orgs = await db.select({ id: organizations.id }).from(organizations);
      for (const org of orgs) {
        await globalScheduler.initialize(org.id);
      }
      if (orgs.length === 0) {
        await globalScheduler.initialize("default-org-id");
      }
    } catch {
      await globalScheduler.initialize("default-org-id");
    }
  })();

  console.log("[Agent Domain] Routes registered (chat, conversations, drafts, config, usage, suggestions, schedules, tools, reports, admin, findings)");
}
