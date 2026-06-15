import type { Express, Request, Response } from "express";
import { generalApiRateLimit } from "../middleware/rate-limiters";
import { z } from "zod";
import { withErrorHandling } from "../lib/route-utils";
import { getConversationService, getRagOrchestrator } from "../services/rag";
import { logger } from "../utils/logger";
import { streamingService } from "../services/rag/streaming";
import { getOpenAIApiKey } from "../openai/client";
import { searchKnowledgeBase } from "../vector-search-service";
import {
  ragInputSanitizationMiddleware,
  ragRateLimitMiddleware,
  type RagSecuredRequest,
} from "../services/rag/security/middleware";
import { getRagSecurityServices } from "../services/rag/security";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { getConversationIdentity, getOrgContext } from "./rag-route-utils";

const askRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  maxSources: z.number().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4096).optional(),
});

export function registerRagAskRoutes(app: Express) {
  app.post(
    "/api/rag/ask",
    generalApiRateLimit,
    (req, res, next) => ragRateLimitMiddleware(req, res, next),
    (req, res, next) => ragInputSanitizationMiddleware(req, res, next),
    withErrorHandling("ask RAG question", async (req, res) => {
      const { orgId, userId, userRoles } = getOrgContext(req);
      const { auditLogger } = getRagSecurityServices();
      const startTime = Date.now();

      const securedReq = req as RagSecuredRequest;
      const parsed = askRequestSchema.parse(req.body);
      const query = securedReq.ragContext?.sanitizedQuery || parsed.query;

      if (parsed.conversationId) {
        const identity = getConversationIdentity(req);
        const owned = await getConversationService().getOwnedConversation(
          parsed.conversationId,
          identity
        );
        if (!owned) {
          return res.status(404).json({ message: "Conversation not found" });
        }
      }

      const orchestrator = getRagOrchestrator();
      const response = await orchestrator.ask({
        orgId,
        userId,
        userRoles,
        query,
        conversationId: parsed.conversationId,
        maxSources: parsed.maxSources,
        threshold: parsed.threshold,
        temperature: parsed.temperature,
        maxTokens: parsed.maxTokens,
      });

      const respAny = response as typeof response & {
        sources?: unknown[];
        confidence?: { score?: number };
      };
      auditLogger.logResponse({
        userId,
        orgId,
        conversationId: response.conversationId || "direct",
        responseLength: response.answer?.length || 0,
        chunksUsed: respAny.sources?.length || 0,
        confidence: respAny.confidence?.score,
        cached: response.cached || false,
        duration: Date.now() - startTime,
      });

      return res.json(response);
    })
  );

  app.get(
    "/api/rag/ask-stream",
    generalApiRateLimit,
    (req, res, next) => ragRateLimitMiddleware(req, res, next),
    async (req: Request, res: Response) => {
      const { auditLogger, sanitizer, config } = getRagSecurityServices();

      let isClientConnected = true;
      req.on("close", () => {
        isClientConnected = false;
        logger.info("[RAG Stream] Client disconnected");
      });

      try {
        let orgId: string;
        let userId: string | undefined;

        const streamingToken = req.query["token"] as string;
        const securedReq = req as RagSecuredRequest;
        if (streamingToken) {
          if (!securedReq.ragContext?.authenticated) {
            auditLogger.logAuthFailure({
              ipAddress: req.ip,
              userAgent: req.get("user-agent"),
              reason: "Invalid or expired streaming token",
            });
            return res.status(401).json({ error: "Invalid or expired streaming token" });
          }
          orgId = securedReq.ragContext.orgId;
          userId = securedReq.ragContext.userId;
        } else if (config.auth.allowHeaderOrgId && process.env["NODE_ENV"] === "development") {
          orgId = DEFAULT_ORG_ID;
          userId =
            (req.query["userId"] as string) || (req.headers["x-user-id"] as string) || undefined;
          logger.warn("[RAG Stream] Using dev-mode auth fallback — NOT for production");
        } else {
          return res.status(401).json({
            error:
              "Streaming token required. Use POST /api/rag/security/streaming-token to obtain one.",
          });
        }

        // Coerce to a definite string: Express query params can arrive as
        // string[] (e.g. ?query=a&query=b), and downstream string ops
        // (.slice, sanitize) would otherwise misbehave (type confusion).
        let query = typeof req.query["query"] === "string" ? req.query["query"] : "";
        const conversationId =
          typeof req.query["conversationId"] === "string" ? req.query["conversationId"] : undefined;

        let conversationHistory: Array<{ role: string; content: string }> | undefined;
        if (conversationId) {
          const conversationService = getConversationService();
          const ownedConversation = await conversationService.getOwnedConversation(conversationId, {
            orgId,
            userId,
          });
          if (!ownedConversation) {
            return res.status(404).json({ error: "Conversation not found" });
          }
          const messages = await conversationService.getMessages(conversationId, 10);
          conversationHistory = messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
        }

        const sanitizeResult = sanitizer.sanitize(query || "");
        if (sanitizeResult.blockedPatterns.length > 0) {
          auditLogger.logPromptInjectionAttempt({
            userId,
            orgId,
            ipAddress: req.ip,
            blockedPatterns: sanitizeResult.blockedPatterns,
            queryPreview: query.slice(0, 200),
          });
        }
        query = sanitizeResult.sanitized;

        if (!query) {
          return res.status(400).json({ error: "Query is required" });
        }

        const apiKey = await getOpenAIApiKey();
        if (!apiKey) {
          return res.status(503).json({ error: "OpenAI API key not configured" });
        }

        if (!streamingService.isInitialized()) {
          await streamingService.initialize(apiKey);
        }

        const searchResults = await (
          searchKnowledgeBase as object as (
            query: string,
            orgId: string,
            limit: number,
            threshold: number
          ) => Promise<
            Array<{ content: string; documentId: string; documentTitle: string; score: number }>
          >
        )(query, orgId, 5, 0.5);

        const relevantChunks = searchResults.map((r) => ({
          content: r.content,
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          score: r.score,
        }));

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        let fullResponse = "";

        return await streamingService.streamResponse(
          { query, relevantChunks, conversationHistory },
          res,
          async (chunk) => {
            if (!isClientConnected) {
              logger.warn("[RAG Stream] Skipping chunk - client disconnected");
              return;
            }

            if (chunk.type === "content" && chunk.content) {
              fullResponse += chunk.content;
            }

            if (chunk.type === "done" && conversationId && fullResponse) {
              try {
                const conversationService = getConversationService();
                const addMessage = conversationService.addMessage as object as (
                  id: string,
                  msg: { role: string; content: string }
                ) => Promise<unknown>;
                await addMessage(conversationId, {
                  role: "user",
                  content: query,
                });
                await addMessage(conversationId, {
                  role: "assistant",
                  content: fullResponse,
                });
                logger.info(
                  `[RAG Stream] Persisted ${fullResponse.length} chars to conversation ${conversationId}`
                );
              } catch (persistError) {
                logger.warn("[RAG Stream] Failed to persist message:", undefined, {
                  details: persistError,
                });
              }
            }
          }
        );
      } catch (error) {
        logger.error("[RAG Stream] Error:", error);
        const message = error instanceof Error ? error.message : "Streaming failed";
        if (!res.headersSent) {
          return res.status(500).json({ error: message });
        }
        res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
        return res.end();
      }
    }
  );
}
