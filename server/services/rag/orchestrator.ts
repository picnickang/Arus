/**
 * RAG Orchestrator
 *
 * Unified entry point that combines all RAG services into a cohesive pipeline.
 * Features:
 * - Query rewriting for improved retrieval
 * - Semantic caching for performance
 * - Conversation context management
 * - Answer generation with citations
 * - Feedback-based re-ranking
 */

import { getAnswerGenerator, type AnswerGenerator } from "./answer-generator";
import { getQueryRewriter, type QueryRewriter } from "./query-rewriter";
import { getConversationService, type ConversationService } from "./conversation-service";
import { getSemanticCache, type SemanticCache } from "./semantic-cache";
import { getFeedbackService, type FeedbackService } from "./feedback-service";
import type { RagAnswerRequest, RagAnswerResponse, FeedbackInput, RagServiceConfig } from "./types";
import { logger } from "../../utils/logger";

export interface OrchestratorConfig {
  enableQueryRewrite?: boolean;
  enableCache?: boolean;
  enableConversationContext?: boolean;
  enableFeedbackReranking?: boolean;
  ragConfig?: Partial<RagServiceConfig>;
}

export class RagOrchestrator {
  private answerGenerator: AnswerGenerator;
  private queryRewriter: QueryRewriter;
  private conversationService: ConversationService;
  private semanticCache: SemanticCache;
  private feedbackService: FeedbackService;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      enableQueryRewrite: config.enableQueryRewrite ?? true,
      enableCache: config.enableCache ?? true,
      enableConversationContext: config.enableConversationContext ?? true,
      enableFeedbackReranking: config.enableFeedbackReranking ?? true,
      ragConfig: config.ragConfig,
    };

    this.answerGenerator = getAnswerGenerator(config.ragConfig);
    this.queryRewriter = getQueryRewriter({ enabled: this.config.enableQueryRewrite });
    this.conversationService = getConversationService();
    this.semanticCache = getSemanticCache({ enabled: this.config.enableCache });
    this.feedbackService = getFeedbackService();
  }

  async ask(request: RagAnswerRequest): Promise<RagAnswerResponse> {
    const startTime = Date.now();
    const { orgId, query, conversationId, userId } = request;

    logger.info(`[RagOrchestrator] Processing query for org ${orgId}`);

    if (this.config.enableCache) {
      const cached = await this.semanticCache.get(orgId, query);
      if (cached) {
        logger.info(`[RagOrchestrator] Cache hit for query`);
        return {
          answer: cached.response,
          citations: cached.citations,
          sourceChunkIds: cached.sourceChunkIds,
          modelUsed: cached.modelUsed,
          latencyMs: Date.now() - startTime,
          cached: true,
        };
      }
    }

    let effectiveQuery = query;
    if (this.config.enableQueryRewrite) {
      const rewritten = await this.queryRewriter.rewrite(query);
      effectiveQuery = rewritten.rewrittenQuery;
      logger.info(`[RagOrchestrator] Query rewritten: "${query}" -> "${effectiveQuery}"`);
    }

    let conversation;
    if (this.config.enableConversationContext && conversationId) {
      conversation = await this.conversationService.getOrCreateConversation({
        conversationId,
        orgId,
        userId,
      });

      await this.conversationService.addMessage({
        conversationId: conversation.id,
        role: "user",
        content: query,
      });
    }

    const response = await this.answerGenerator.generateAnswer({
      ...request,
      query: effectiveQuery,
    });

    if (this.config.enableConversationContext && conversation) {
      const message = await this.conversationService.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: response.answer,
        sourceChunkIds: response.sourceChunkIds,
        citations: response.citations,
        tokenCount: response.tokenCount,
        modelUsed: response.modelUsed,
        latencyMs: response.latencyMs,
      });

      response.conversationId = conversation.id;
      response.messageId = message.id;
    }

    if (this.config.enableCache && !response.cached) {
      await this.semanticCache.set({
        orgId,
        query,
        response: response.answer,
        citations: response.citations,
        sourceChunkIds: response.sourceChunkIds,
        modelUsed: response.modelUsed,
      });
    }

    response.latencyMs = Date.now() - startTime;
    logger.info(`[RagOrchestrator] Generated answer in ${response.latencyMs}ms`);

    return response;
  }

  async askWithConversation(request: RagAnswerRequest): Promise<RagAnswerResponse> {
    const { orgId, userId, conversationId } = request;

    const conversation = await this.conversationService.getOrCreateConversation({
      conversationId,
      orgId,
      userId,
      title: request.query.substring(0, 50),
    });

    return this.ask({
      ...request,
      conversationId: conversation.id,
    });
  }

  async submitFeedback(input: FeedbackInput): Promise<void> {
    await this.feedbackService.submitFeedback(input);

    if (input.feedbackType === "inaccurate" || input.feedbackType === "outdated") {
      await this.semanticCache.invalidate(input.orgId, input.queryText);
      logger.info(`[RagOrchestrator] Invalidated cache due to ${input.feedbackType} feedback`);
    }
  }

  async getConversationHistory(conversationId: string) {
    return this.conversationService.getMessages(conversationId);
  }

  async listConversations(params: { orgId: string; userId?: string; limit?: number }) {
    return this.conversationService.listConversations({
      orgId: params.orgId,
      userId: params.userId,
      limit: params.limit,
      activeOnly: true,
    });
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    return this.conversationService.deleteConversation(conversationId);
  }

  async getCacheStats(orgId: string) {
    return this.semanticCache.getStats(orgId);
  }

  async getFeedbackStats(orgId: string) {
    return this.feedbackService.getOrgStats(orgId);
  }

  async cleanupExpiredCache(): Promise<number> {
    return this.semanticCache.cleanup();
  }
}

let defaultInstance: RagOrchestrator | null = null;

export function getRagOrchestrator(config?: OrchestratorConfig): RagOrchestrator {
  if (!defaultInstance || config) {
    defaultInstance = new RagOrchestrator(config);
  }
  return defaultInstance;
}

export async function askRag(request: RagAnswerRequest): Promise<RagAnswerResponse> {
  return getRagOrchestrator().ask(request);
}
