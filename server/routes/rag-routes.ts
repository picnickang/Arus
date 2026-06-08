/**
 * RAG API Routes
 *
 * API endpoints for the RAG (Retrieval-Augmented Generation) system.
 * Provides endpoints for:
 * - Asking questions and getting AI-powered answers
 * - Managing conversations
 * - Submitting feedback
 * - Cache management
 *
 * Security hardened with:
 * - Session-based authentication (with streaming token support for SSE)
 * - Per-user rate limiting with Redis backing
 * - Input sanitization for prompt injection protection
 * - Audit logging for all operations
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling } from "../lib/route-utils";
import {
  getRagOrchestrator,
  getConversationService,
  getFeedbackService,
  getSemanticCache,
} from "../services/rag";
import { logger } from "../utils/logger";
import { streamingService } from "../services/rag/streaming";
import { suggestionEngine } from "../services/rag/suggestions";
import { exportService } from "../services/rag/export";
import { analyticsAggregator } from "../services/rag/analytics";
import { confidenceDetector } from "../services/rag/confidence";
import { comparisonService } from "../services/rag/comparison";
import { getOpenAIApiKey } from "../openai/client";
import { searchKnowledgeBase } from "../vector-search-service";
import {
  ragAuthMiddleware,
  ragRateLimitMiddleware,
  ragInputSanitizationMiddleware,
  type RagSecuredRequest,
} from "../services/rag/security/middleware";
import { initializeRagSecurity, getRagSecurityServices } from "../services/rag/security";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const askRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  maxSources: z.number().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4096).optional(),
});

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

function toExportDate(value: unknown): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0) : value;
  }

  if (typeof value === "number") {
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    const date =
      trimmed !== "" && Number.isFinite(numeric)
        ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
        : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  return new Date(0);
}

export function registerRagRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit, reportGenerationRateLimit } = rateLimiters;

  // Initialize RAG security services
  initializeRagSecurity();

  // Helper to extract org context from secured request
  const getOrgContext = (req: Request) => {
    const securedReq = req as RagSecuredRequest;
    return {
      orgId: securedReq.ragContext?.orgId || DEFAULT_ORG_ID,
      userId: securedReq.ragContext?.userId || (req.headers["x-user-id"] as string) || undefined,
      userRoles: req.headers["x-user-roles"]
        ? (req.headers["x-user-roles"] as string).split(",")
        : undefined,
    };
  };

  // Trusted identity for conversation ownership. Derived only from the
  // authenticated RAG context (session or validated streaming token) set
  // by ragAuthMiddleware — never from a client-supplied `x-user-id`
  // header, which a caller can spoof.
  const getConversationIdentity = (req: Request): { orgId: string; userId: string } => {
    const securedReq = req as RagSecuredRequest;
    return {
      orgId: securedReq.ragContext?.orgId ?? DEFAULT_ORG_ID,
      userId: securedReq.ragContext?.userId ?? "anonymous",
    };
  };

  // Apply security middleware to all RAG routes
  app.use("/api/rag", (req, res, next) => ragAuthMiddleware(req, res, next));

  app.post(
    "/api/rag/ask",
    (req, res, next) => ragRateLimitMiddleware(req, res, next),
    (req, res, next) => ragInputSanitizationMiddleware(req, res, next),
    withErrorHandling("ask RAG question", async (req, res) => {
      const { orgId, userId, userRoles } = getOrgContext(req);
      const { auditLogger } = getRagSecurityServices();
      const startTime = Date.now();

      // Use sanitized query if available
      const securedReq = req as RagSecuredRequest;
      const parsed = askRequestSchema.parse(req.body);
      const query = securedReq.ragContext?.sanitizedQuery || parsed.query;

      // When the caller targets an existing conversation, verify ownership
      // before the orchestrator appends messages to it. Without this gate a
      // caller could mutate another user's thread by guessing its id (IDOR).
      // Identity is taken from the trusted ragContext, never a spoofable
      // header. New conversations (no id) are created owned by the caller.
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

      // Log successful response
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
      const orgId = DEFAULT_ORG_ID;
      const userId = (req.headers["x-user-id"] as string) || undefined;

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
      const orgId = DEFAULT_ORG_ID;

      const feedbackService = getFeedbackService();
      const stats = await feedbackService.getOrgStats(orgId);

      return res.json(stats);
    })
  );

  app.get(
    "/api/rag/cache/stats",
    generalApiRateLimit,
    withErrorHandling("get RAG cache stats", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;

      const cache = getSemanticCache();
      const stats = await cache.getStats(orgId);

      return res.json(stats);
    })
  );

  app.post(
    "/api/rag/cache/cleanup",
    generalApiRateLimit,
    withErrorHandling("cleanup RAG cache", async (req, res) => {
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

  // === STREAMING ENDPOINT ===
  // Uses orchestrator for tenant isolation and persistence
  // Uses streaming tokens for SSE authentication (EventSource can't send headers)
  app.get(
    "/api/rag/ask-stream",
    (req, res, next) => ragRateLimitMiddleware(req, res, next),
    async (req: Request, res: Response) => {
      const { auditLogger, sanitizer, config } = getRagSecurityServices();

      // Track client disconnect
      let isClientConnected = true;
      req.on("close", () => {
        isClientConnected = false;
        logger.info("[RAG Stream] Client disconnected");
      });

      try {
        // Authenticate via streaming token (preferred) or session
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

        let query = req.query["query"] as string;
        const conversationId = req.query["conversationId"] as string | undefined;

        // Verify the authenticated caller owns the conversation BEFORE doing
        // any expensive work (sanitize, OpenAI, vector search) or loading its
        // history — otherwise a caller could read another user's messages or
        // write into their thread by guessing the id. SSE headers are not
        // sent yet, so a plain 404 is safe to return here.
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

        // Sanitize query
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

        // Use orchestrator for proper tenant-scoped search
        const orchestrator = getRagOrchestrator();
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

        // Set SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        // Accumulate full response for persistence
        let fullResponse = "";

        return await streamingService.streamResponse(
          { query, relevantChunks, conversationHistory },
          res,
          async (chunk) => {
            // Check if client disconnected
            if (!isClientConnected) {
              logger.warn("[RAG Stream] Skipping chunk - client disconnected");
              return;
            }

            // Accumulate content for persistence
            if (chunk.type === "content" && chunk.content) {
              fullResponse += chunk.content;
            }

            // On completion, persist the full message if conversation exists
            if (chunk.type === "done" && conversationId && fullResponse) {
              try {
                const conversationService = getConversationService();
                // Add user's query first
                const addMessage = conversationService.addMessage as object as (
                  id: string,
                  msg: { role: string; content: string }
                ) => Promise<unknown>;
                await addMessage(conversationId, {
                  role: "user",
                  content: query,
                });
                // Add full AI response
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
        // Send error event through SSE
        res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
        return res.end();
      }
    }
  );

  // === SUGGESTIONS ENDPOINT ===
  app.get(
    "/api/rag/suggestions",
    generalApiRateLimit,
    withErrorHandling("get RAG suggestions", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const conversationId = req.query["conversationId"] as string | undefined;

      const apiKey = await getOpenAIApiKey();
      if (apiKey && !suggestionEngine.isInitialized()) {
        await suggestionEngine.initialize(apiKey);
      }

      const suggestions = await suggestionEngine.generateSuggestions(
        {
          documentTopics: ["marine maintenance", "engine systems", "safety procedures"],
        },
        5
      );

      return res.json({ success: true, suggestions });
    })
  );

  // === EXPORT ENDPOINT ===
  app.get(
    "/api/rag/conversations/:id/export",
    generalApiRateLimit,
    withErrorHandling("export conversation", async (req, res) => {
      const { id = "" } = req.params;
      const format = (req.query["format"] as "pdf" | "markdown") || "markdown";
      const includeCitations = req.query["includeCitations"] !== "false";
      const includeTimestamps = req.query["includeTimestamps"] !== "false";
      const { orgId, userId } = getConversationIdentity(req);

      const conversationService = getConversationService();
      const conversation = await conversationService.getOwnedConversation(id, { orgId, userId });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await conversationService.getMessages(id, 1000);

      const convAny = conversation as { conversation?: Record<string, unknown> } & Record<
        string,
        unknown
      >;
      const convObj = (convAny.conversation ?? convAny) as {
        id: string;
        title?: string;
        createdAt: string | number | Date;
      };

      // P2 #10 — DoS / memory cap. PDF and Markdown export build the
      // whole document in memory; an adversary (or just a runaway
      // assistant) could stuff a single message with megabytes of
      // text. Cap the total content byte-budget BEFORE handing data to
      // the export service, and trim from the OLDEST messages first so
      // the most recent context is preserved.
      const MAX_EXPORT_CONTENT_BYTES = 2 * 1024 * 1024; // ≈2 MiB raw text
      const rawMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: toExportDate(m.createdAt),
        citations: (
          m as { citations?: Array<{ documentId: string; documentTitle: string; excerpt: string }> }
        ).citations,
      }));
      const trimmed: typeof rawMessages = [];
      let runningBytes = 0;
      let truncated = false;
      const TRUNCATION_NOTICE = "\n\n[…content truncated to fit export size budget…]";
      for (let i = rawMessages.length - 1; i >= 0; i--) {
        const m = rawMessages[i];
        if (!m) {
          continue;
        }
        const size =
          Buffer.byteLength(m.content, "utf-8") +
          (m.citations?.reduce(
            (a, c) => a + Buffer.byteLength(c.documentTitle + c.excerpt, "utf-8"),
            0
          ) ?? 0);
        if (runningBytes + size > MAX_EXPORT_CONTENT_BYTES) {
          // Preserve newest-message context even when a single message
          // is larger than the remaining budget: emit a truncated
          // copy rather than dropping it entirely. Strip citations on
          // the truncated message since the excerpt bytes already
          // exceeded budget.
          if (trimmed.length === 0) {
            const remaining = Math.max(0, MAX_EXPORT_CONTENT_BYTES - runningBytes);
            const sliceBytes = Math.max(
              0,
              remaining - Buffer.byteLength(TRUNCATION_NOTICE, "utf-8")
            );
            const head = Buffer.from(m.content, "utf-8").subarray(0, sliceBytes).toString("utf-8");
            trimmed.unshift({
              role: m.role,
              content: head + TRUNCATION_NOTICE,
              timestamp: m.timestamp,
              citations: undefined,
            });
          }
          truncated = true;
          break;
        }
        runningBytes += size;
        trimmed.unshift(m);
      }
      const exportData = {
        id: convObj.id,
        title: convObj.title || "Untitled Conversation",
        createdAt: toExportDate(convObj.createdAt),
        messages: trimmed,
      };

      const result = await exportService.exportConversation(exportData, {
        format,
        includeCitations,
        includeTimestamps,
        ...(truncated
          ? {
              footerText: `Export truncated: omitted ${rawMessages.length - trimmed.length} older message(s) to stay within the ${MAX_EXPORT_CONTENT_BYTES} byte content budget.`,
            }
          : {}),
      });

      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      if (truncated) {
        res.setHeader("X-Export-Truncated", "true");
        res.setHeader("X-Export-Omitted-Messages", String(rawMessages.length - trimmed.length));
      }
      return res.send(result.data);
    })
  );

  // === ANALYTICS ENDPOINT ===
  app.get(
    "/api/rag/analytics",
    generalApiRateLimit,
    withErrorHandling("get RAG analytics", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;

      const analytics = await analyticsAggregator.getSummary(orgId);

      return res.json({ success: true, analytics });
    })
  );

  // === COMPARISON ENDPOINT ===
  const comparisonSchema = z.object({
    query: z.string().min(1).max(2000),
    documentIds: z.array(z.string()).min(2).max(5),
    maxChunksPerDoc: z.number().optional(),
  });

  app.post(
    "/api/rag/compare",
    reportGenerationRateLimit,
    withErrorHandling("compare documents", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const parsed = comparisonSchema.parse(req.body);

      const apiKey = await getOpenAIApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: "OpenAI API key not configured" });
      }

      if (!comparisonService.isInitialized()) {
        await comparisonService.initialize(apiKey);
      }

      const result = await comparisonService.compare(parsed, orgId);

      return res.json({ success: true, result });
    })
  );

  // === CONFIDENCE ALERTS ENDPOINT ===
  app.get(
    "/api/rag/alerts",
    generalApiRateLimit,
    withErrorHandling("get confidence alerts", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const includeAcknowledged = req.query["includeAcknowledged"] === "true";

      const alerts = confidenceDetector.getAlerts(orgId, includeAcknowledged);

      return res.json({ success: true, alerts });
    })
  );

  app.post(
    "/api/rag/alerts/:alertId/acknowledge",
    generalApiRateLimit,
    withErrorHandling("acknowledge alert", async (req, res) => {
      const { alertId = "" } = req.params;

      const acknowledged = confidenceDetector.acknowledgeAlert(alertId);

      if (!acknowledged) {
        return res.status(404).json({ error: "Alert not found" });
      }

      return res.json({ success: true });
    })
  );

  logger.info(
    "[RAG Routes] Registered (ask, ask-stream, conversations, feedback, cache, suggestions, export, analytics, compare, alerts)"
  );
}
