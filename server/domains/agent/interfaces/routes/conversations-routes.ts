import type { Express, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { agentRepo } from "../../infrastructure/repository";
import type { RateLimitMiddleware } from "./_shared";

export interface ConversationsRouteDeps {
  rateLimit: RateLimitMiddleware;
}

export function registerConversationsRoutes(app: Express, deps: ConversationsRouteDeps) {
  const { rateLimit } = deps;

  app.get(
    "/api/agent/conversations",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const conversations = await agentRepo.conversations.list(orgId, userId);
        return res.json(conversations);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/conversations/:id",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const conversation = await agentRepo.conversations.get(req.params.id, orgId);
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        return res.json(conversation);
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.get(
    "/api/agent/conversations/:id/messages",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const conversation = await agentRepo.conversations.get(req.params.id, orgId);
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        const messages = await agentRepo.messages.list(req.params.id);
        const toolCalls = await agentRepo.toolCalls.list(req.params.id);
        return res.json({ messages, toolCalls });
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.delete(
    "/api/agent/conversations/:id",
    rateLimit.writeOperationRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const conversation = await agentRepo.conversations.get(req.params.id, orgId);
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        await agentRepo.conversations.delete(req.params.id);
        return res.json({ success: true });
      } catch (error: unknown) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
