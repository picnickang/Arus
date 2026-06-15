import type { Express } from "express";
import { z } from "zod";
import { withErrorHandling } from "../lib/route-utils";
import {
  getConversationService,
  getFeedbackService,
  getRagOrchestrator,
  getSemanticCache,
} from "../services/rag";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { getConversationIdentity, type RagRouteRateLimiters } from "./rag-route-utils";

const feedbackSchema = z.object({
  messageId: z.string().optional(),
  chunkId: z.string().optional(),
  feedbackType: z.enum(["helpful", "not_helpful", "inaccurate", "missing_info", "outdated"]),
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  queryText: z.string().optional(),
});

const conversationUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

export function registerRagConversationRoutes(
  app: Express,
  { generalApiRateLimit }: Pick<RagRouteRateLimiters, "generalApiRateLimit">
) {
  app.post(
    "/api/rag/conversations",
    generalApiRateLimit,
    withErrorHandling("create RAG conversation", async (req, res) => {
      const { orgId, userId } = getConversationIdentity(req);
      const { title } = req.body;

      const conversationService = getConversationService();
      const conversation = await conversationService.createConversation({
        orgId,
        userId,
        title,
      });

      return res.status(201).json(conversation);
    })
  );

  app.get(
    "/api/rag/conversations",
    generalApiRateLimit,
    withErrorHandling("list RAG conversations", async (req, res) => {
      const { orgId, userId } = getConversationIdentity(req);
      const limit = parseInt(req.query["limit"] as string) || 20;

      const conversationService = getConversationService();
      const conversations = await conversationService.listConversations({
        orgId,
        userId,
        limit,
        activeOnly: true,
      });

      return res.json(conversations);
    })
  );

  app.get(
    "/api/rag/conversations/:id",
    generalApiRateLimit,
    withErrorHandling("get RAG conversation", async (req, res) => {
      const { id = "" } = req.params;
      const { orgId, userId } = getConversationIdentity(req);

      const conversationService = getConversationService();
      const conversation = await conversationService.getOwnedConversation(id, { orgId, userId });

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await conversationService.getMessages(id, 100);
      return res.json({ conversation, messages });
    })
  );

  app.get(
    "/api/rag/conversations/:id/messages",
    generalApiRateLimit,
    withErrorHandling("get conversation messages", async (req, res) => {
      const { id = "" } = req.params;
      const limit = parseInt(req.query["limit"] as string) || 100;
      const { orgId, userId } = getConversationIdentity(req);

      const conversationService = getConversationService();
      const conversation = await conversationService.getOwnedConversation(id, { orgId, userId });

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await conversationService.getMessages(id, limit);

      return res.json(messages);
    })
  );

  app.patch(
    "/api/rag/conversations/:id",
    generalApiRateLimit,
    withErrorHandling("update RAG conversation", async (req, res) => {
      const { id = "" } = req.params;
      const parsed = conversationUpdateSchema.parse(req.body);
      const { orgId, userId } = getConversationIdentity(req);

      const conversationService = getConversationService();
      const owned = await conversationService.getOwnedConversation(id, { orgId, userId });

      if (!owned) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const updated = await conversationService.updateConversation(id, parsed);

      if (!updated) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      return res.json(updated);
    })
  );

  app.delete(
    "/api/rag/conversations/:id",
    generalApiRateLimit,
    withErrorHandling("delete RAG conversation", async (req, res) => {
      const { id = "" } = req.params;
      const { orgId, userId } = getConversationIdentity(req);

      const conversationService = getConversationService();
      const owned = await conversationService.getOwnedConversation(id, { orgId, userId });

      if (!owned) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const deleted = await conversationService.deleteConversation(id);

      if (!deleted) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      return res.status(204).send();
    })
  );

  app.post(
    "/api/rag/feedback",
    generalApiRateLimit,
    withErrorHandling("submit RAG feedback", async (req, res) => {
      const { orgId, userId } = getConversationIdentity(req);

      const parsed = feedbackSchema.parse(req.body);

      const orchestrator = getRagOrchestrator();
      await orchestrator.submitFeedback({
        orgId,
        userId,
        ...parsed,
      });

      return res.status(201).json({ success: true });
    })
  );

  app.get(
    "/api/rag/feedback/stats",
    generalApiRateLimit,
    withErrorHandling("get RAG feedback stats", async (req, res) => {
      const { orgId } = getConversationIdentity(req);

      const feedbackService = getFeedbackService();
      const stats = await feedbackService.getOrgStats(orgId);

      return res.json(stats);
    })
  );

  app.get(
    "/api/rag/cache/stats",
    generalApiRateLimit,
    withErrorHandling("get RAG cache stats", async (_req, res) => {
      const orgId = DEFAULT_ORG_ID;

      const cache = getSemanticCache();
      const stats = await cache.getStats(orgId);

      return res.json(stats);
    })
  );

  app.post(
    "/api/rag/cache/cleanup",
    generalApiRateLimit,
    withErrorHandling("cleanup RAG cache", async (_req, res) => {
      const cache = getSemanticCache();
      const cleaned = await cache.cleanup();

      return res.json({ cleanedEntries: cleaned });
    })
  );

  app.delete(
    "/api/rag/cache",
    generalApiRateLimit,
    withErrorHandling("invalidate RAG cache", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const { query } = req.query;

      const cache = getSemanticCache();
      const invalidated = await cache.invalidate(orgId, query as string | undefined);

      return res.json({ invalidatedEntries: invalidated });
    })
  );
}
