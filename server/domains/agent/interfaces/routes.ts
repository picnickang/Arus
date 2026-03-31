import type { Express, Request, Response } from "express";
import { runAgent, runAgentStream } from "../orchestrator";
import { agentRepository } from "../repository";
import { storage } from "../../../storage";
import type { AuthenticatedRequest } from "../../../middleware/auth";

interface RateLimitMiddleware {
  generalApiRateLimit: any;
  writeOperationRateLimit: any;
}

export function registerAgentRoutes(app: Express, rateLimit: RateLimitMiddleware) {
  app.post("/api/agent/chat", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const result = await runAgent(orgId, userId, conversationId, message);
      res.json({
        conversationId: result.conversation.id,
        response: result.finalResponse,
        toolCallCount: result.toolCallCount,
        totalTokens: result.totalTokens,
      });
    } catch (error: any) {
      console.error("[Agent] Chat error:", error);
      res.status(500).json({ error: error.message || "Agent error" });
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

      await runAgentStream(orgId, userId, conversationId, message, (chunk) => {
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
      const conversations = await agentRepository.listConversations(orgId, userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/conversations/:id", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepository.getConversation(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/conversations/:id/messages", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const conversation = await agentRepository.getConversation(req.params.id, orgId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      const messages = await agentRepository.getMessages(req.params.id);
      const toolCalls = await agentRepository.getToolCalls(req.params.id);
      res.json({ messages, toolCalls });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/drafts", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const status = req.query.status as string | undefined;
      const drafts = await agentRepository.listDrafts(orgId, status);
      res.json(drafts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/drafts/:id/approve", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const draft = await agentRepository.getDraft(req.params.id, orgId);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status !== "pending") return res.status(400).json({ error: "Draft is not pending" });

      let resultId: string | undefined;

      if (draft.draftType === "work_order") {
        const woData = draft.data as any;
        const wo = await storage.createWorkOrder({
          ...woData,
          status: "open",
          orgId,
        });
        resultId = wo.id;
      }

      const updated = await agentRepository.updateDraft(draft.id, {
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
      const draft = await agentRepository.getDraft(req.params.id, orgId);
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status !== "pending") return res.status(400).json({ error: "Draft is not pending" });

      const updated = await agentRepository.updateDraft(draft.id, {
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
      const config = await agentRepository.getConfig(orgId);
      res.json(config || { defaultModel: "gpt-4o-mini", maxIterationsPerRun: 10 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/agent/config", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const config = await agentRepository.upsertConfig({ ...req.body, orgId });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/suggestions", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const status = req.query.status as string | undefined;
      const suggestions = await agentRepository.listSuggestions(orgId, status);
      res.json(suggestions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/schedules", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedules = await agentRepository.listSchedules(orgId);
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/agent/schedules", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await agentRepository.createSchedule({ ...req.body, orgId });
      res.status(201).json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/agent/schedules/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepository.getSchedule(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const schedule = await agentRepository.updateSchedule(req.params.id, req.body);
      res.json(schedule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/agent/schedules/:id", rateLimit.writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepository.getSchedule(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      await agentRepository.deleteSchedule(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/agent/schedules/:id/runs", rateLimit.generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await agentRepository.getSchedule(req.params.id, orgId);
      if (!existing) return res.status(404).json({ error: "Schedule not found" });
      const runs = await agentRepository.getScheduleRuns(req.params.id);
      res.json(runs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
