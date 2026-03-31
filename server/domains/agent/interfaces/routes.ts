import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AgentOrchestrator } from "../application/orchestrator";
import { SafetyService } from "../application/safety-service";
import { SuggestionEngine } from "../application/suggestion-engine";
import { SchedulerService } from "../application/scheduler-service";
import { agentRepo } from "../infrastructure/repository";
import { storage } from "../../../storage";
import type { AuthenticatedRequest } from "../../../middleware/auth";

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
  generalApiRateLimit: any;
  writeOperationRateLimit: any;
}

export function registerAgentRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  const orchestrator = new AgentOrchestrator(agentRepo);
  const safety = new SafetyService(agentRepo);
  const suggestionEngine = new SuggestionEngine(agentRepo);

  app.post("/api/agent/chat", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const result = await orchestrator.run(orgId, userId, conversationId, message);
      res.json({
        conversationId: result.conversationId,
        response: result.finalResponse,
        toolCalls: result.toolCalls,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      });
    } catch (error: any) {
      console.error("[Agent] Chat error:", error);
      res.status(500).json({ error: error.message || "Agent error" });
    }
  });

  app.post("/api/agent/chat-multimodal", rateLimit.writeOperationRateLimit, upload.array("files", 5), async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
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

      const result = await orchestrator.runWithAttachments(orgId, userId, conversationId, message, attachments);

      res.json({
        conversationId: result.conversationId,
        response: result.finalResponse,
        toolCalls: result.toolCalls,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      });
    } catch (error: any) {
      console.error("[Agent] Multimodal chat error:", error);
      res.status(500).json({ error: error.message || "Agent error" });
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
      });

      res.end();
    } catch (error: any) {
      console.error("[Agent] Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Agent stream error" });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/conversations/:id", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepo.conversations.get(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/agent/conversations/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepo.conversations.get(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      await agentRepo.conversations.delete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/drafts", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const status = req.query.status as string | undefined;
      const drafts = await agentRepo.drafts.list(orgId, status);
      res.json(drafts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/drafts/:id/approve", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const draft = await agentRepo.drafts.get(req.params.id, orgId);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status !== "pending") return res.status(400).json({ error: "Draft is not pending" });

      let resultId: string | undefined;

      if (draft.draftType === "work_order") {
        const woData = draft.data as any;
        const wo = await storage.createWorkOrder({ ...woData, status: "open", orgId });
        resultId = wo.id;
      }

      const updated = await agentRepo.drafts.update(draft.id, {
        status: "approved",
        reviewedById: userId,
        reviewNote: req.body.note,
        resultId,
      });
      res.json({ draft: updated, resultId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/drafts/:id/reject", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
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
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/config", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const config = await agentRepo.config.get(orgId);
      res.json(config || { defaultModel: "gpt-4o-mini", maxIterationsPerRun: 10, maxTokensPerConversation: 50000, dailyTokenLimit: 500000, monthlyTokenLimit: 5000000 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/agent/config", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const config = await agentRepo.config.upsert({ ...req.body, orgId });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/usage", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const days = parseInt(req.query.days as string) || 30;
      const stats = await safety.getUsageStats(orgId, days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/suggestions", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const status = req.query.status as string | undefined;
      const suggestions = await agentRepo.suggestions.list(orgId, status);
      res.json(suggestions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/suggestions/generate", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const count = await suggestionEngine.generateProactiveSuggestions(orgId);
      res.json({ generated: count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/agent/suggestions/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.suggestions.list(orgId);
      const match = existing.find(s => s.id === req.params.id);
      if (!match) return res.status(404).json({ error: "Suggestion not found" });
      const suggestion = await agentRepo.suggestions.update(req.params.id, req.body);
      res.json(suggestion);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/schedules", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedules = await agentRepo.schedules.list(orgId);
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/schedules", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await agentRepo.schedules.create({ ...req.body, orgId });
      res.status(201).json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/agent/schedules/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.schedules.get(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const schedule = await agentRepo.schedules.update(req.params.id, req.body);
      res.json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/agent/schedules/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.schedules.get(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      await agentRepo.schedules.delete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/schedules/:id/runs", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepo.schedules.get(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const runs = await agentRepo.schedules.getRuns(req.params.id);
      res.json(runs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/schedules/:id/run", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await agentRepo.schedules.get(req.params.id, orgId);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });

      const schedulerService = new SchedulerService(
        agentRepo,
        (org, user, conv, msg) => orchestrator.run(org, user, conv, msg),
      );
      await schedulerService.executeSchedule(schedule);
      res.json({ success: true, message: "Schedule run triggered" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log("[Agent Domain] Routes registered (chat, conversations, drafts, config, usage, suggestions, schedules)");
}
