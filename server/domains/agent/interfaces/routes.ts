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
import { MAINTENANCE_ROLES } from "../domain/types";
import { storage } from "../../../storage";
import { db } from "../../../db";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { auditAction } from "../../../utils/audit-helpers";
import { z } from "zod";

const UPLOAD_DIR = "/tmp/agent-uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/png", "image/jpeg", "image/gif", "image/webp",
      "application/pdf", "text/plain", "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

interface RateLimitMiddleware {
  generalApiRateLimit: (req: Request, res: Response, next: () => void) => void;
  writeOperationRateLimit: (req: Request, res: Response, next: () => void) => void;
}

export function registerAgentRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const orchestrator = new AgentOrchestrator(agentRepo);
  const safety = new SafetyService(agentRepo);
  const suggestionEngine = new SuggestionEngine(agentRepo);

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

      res.json({
        conversationId: result.conversationId,
        response: result.finalResponse,
        toolCalls: result.toolCalls,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      });
    } catch (error: unknown) {
      console.error("[Agent] Multimodal chat error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Agent error" });
    } finally {
      for (const f of files) {
        fs.unlink(f.path, () => {});
      }
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

      let resultId: string | undefined;

      if (draft.draftType === "work_order") {
        const woData = draft.data as Record<string, unknown>;
        const wo = await storage.createWorkOrder({ ...woData, status: "open", orgId });
        resultId = wo.id;
      } else if (draft.draftType === "report_share") {
        const shareData = draft.data as Record<string, unknown>;
        const recipients = shareData.recipients as string[];
        const subject = shareData.subject as string;
        const bodyText = shareData.message as string || "Please find the attached ARUS report.";
        const reportArtifact = getReportArtifact(shareData.reportId as string);

        const { emailSender } = await import("../../../services/email-notification/email-sender.js");
        const sendErrors: string[] = [];

        if (!reportArtifact || !fs.existsSync(reportArtifact.filePath)) {
          return res.status(404).json({
            error: "Report artifact not found or file no longer available. Cannot share without the report file.",
          });
        }

        if (reportArtifact.orgId !== orgId) {
          return res.status(403).json({ error: "Access denied to report artifact" });
        }

        const fileContent = fs.readFileSync(reportArtifact.filePath);
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          json: "application/json",
          csv: "text/csv",
          txt: "text/plain",
        };
        for (const recipient of recipients) {
          try {
            await emailSender.sendWithAttachment(
              recipient,
              subject,
              bodyText,
              `<p>${bodyText}</p>`,
              {
                filename: reportArtifact.fileName,
                content: fileContent,
                contentType: mimeMap[reportArtifact.format] || "application/octet-stream",
              }
            );
          } catch (err) {
            sendErrors.push(`${recipient}: ${err instanceof Error ? err.message : "send failed"}`);
          }
        }

        if (sendErrors.length > 0 && sendErrors.length === recipients.length) {
          console.error(`[Agent] Report share failed for all recipients:`, sendErrors);
          return res.status(502).json({
            error: "Failed to send report to all recipients",
            details: sendErrors,
          });
        }

        if (sendErrors.length > 0) {
          console.warn(`[Agent] Report share partial failure:`, sendErrors);
        }

        console.log(`[Agent] Report share sent: ${shareData.reportId} → ${recipients.join(", ")} (${sendErrors.length} failures)`);
        resultId = shareData.reportId as string;
      }

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
      res.json(config || { defaultModel: "gpt-4o-mini", maxIterationsPerRun: 10, maxTokensPerConversation: 50000, dailyTokenLimit: 500000, monthlyTokenLimit: 5000000 });
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

  app.post("/api/agent/suggestions/:id/dismiss", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.suggestions.list(orgId, undefined, 1000);
      const match = existing.find(s => s.id === req.params.id);
      if (!match) return res.status(404).json({ error: "Suggestion not found" });
      const suggestion = await agentRepo.suggestions.update(req.params.id, { status: "dismissed" });
      res.json(suggestion);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/agent/suggestions/:id/act", rateLimit.writeOperationRateLimit, requireMaintenanceRole, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.suggestions.list(orgId, undefined, 1000);
      const match = existing.find(s => s.id === req.params.id);
      if (!match) return res.status(404).json({ error: "Suggestion not found" });
      const suggestion = await agentRepo.suggestions.update(req.params.id, { actedOn: true, status: "acted" });
      res.json(suggestion);
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

  console.log("[Agent Domain] Routes registered (chat, conversations, drafts, config, usage, suggestions, schedules, tools, reports, admin)");
}
