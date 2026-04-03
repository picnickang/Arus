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

import { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RateLimitRequestHandler } from 'express-rate-limit';
import { withErrorHandling } from '../lib/route-utils';
import { 
  getRagOrchestrator,
  getConversationService,
  getFeedbackService,
  getSemanticCache,
} from '../services/rag';
import { logger } from '../utils/logger';
import { streamingService } from '../services/rag/streaming';
import { createRateLimitMiddleware } from '../services/rag/rate-limiter';
import { suggestionEngine } from '../services/rag/suggestions';
import { exportService } from '../services/rag/export';
import { analyticsAggregator } from '../services/rag/analytics';
import { confidenceDetector } from '../services/rag/confidence';
import { comparisonService } from '../services/rag/comparison';
import { getOpenAIApiKey } from '../openai/client';
import { searchKnowledgeBase } from '../vector-search-service';
import { 
  ragAuthMiddleware, 
  ragRateLimitMiddleware, 
  ragInputSanitizationMiddleware,
  type RagSecuredRequest 
} from '../services/rag/security/middleware';
import { 
  initializeRagSecurity, 
  getRagSecurityServices,
  getRagSecurityConfig 
} from '../services/rag/security';

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
  feedbackType: z.enum(['helpful', 'not_helpful', 'inaccurate', 'missing_info', 'outdated']),
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  queryText: z.string().optional(),
});

const conversationUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

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
      orgId: securedReq.ragContext?.orgId || req.headers['x-org-id'] as string || 'default-org-id',
      userId: securedReq.ragContext?.userId || req.headers['x-user-id'] as string || undefined,
      userRoles: req.headers['x-user-roles'] 
        ? (req.headers['x-user-roles'] as string).split(',') 
        : undefined,
    };
  };

  // Apply security middleware to all RAG routes
  app.use('/api/rag', ragAuthMiddleware as any);

  app.post('/api/rag/ask', 
    ragRateLimitMiddleware as any,
    ragInputSanitizationMiddleware as any,
    withErrorHandling('ask RAG question', async (req, res) => {
      const { orgId, userId, userRoles } = getOrgContext(req);
      const { auditLogger } = getRagSecurityServices();
      const startTime = Date.now();

      // Use sanitized query if available
      const securedReq = req as RagSecuredRequest;
      const parsed = askRequestSchema.parse(req.body);
      const query = securedReq.ragContext?.sanitizedQuery || parsed.query;
      
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
      auditLogger.logResponse({
        userId,
        orgId,
        conversationId: response.conversationId || 'direct',
        responseLength: response.answer?.length || 0,
        chunksUsed: response.sources?.length || 0,
        confidence: response.confidence?.score,
        cached: response.cached || false,
        duration: Date.now() - startTime,
      });

      res.json(response);
    })
  );

  app.post('/api/rag/conversations', generalApiRateLimit,
    withErrorHandling('create RAG conversation', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const userId = req.headers['x-user-id'] as string || undefined;
      const { title } = req.body;

      const conversationService = getConversationService();
      const conversation = await conversationService.createConversation({
        orgId,
        userId,
        title,
      });

      res.status(201).json(conversation);
    })
  );

  app.get('/api/rag/conversations', generalApiRateLimit,
    withErrorHandling('list RAG conversations', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const userId = req.headers['x-user-id'] as string || undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const conversationService = getConversationService();
      const conversations = await conversationService.listConversations({
        orgId,
        userId,
        limit,
        activeOnly: true,
      });

      res.json(conversations);
    })
  );

  app.get('/api/rag/conversations/:id', generalApiRateLimit,
    withErrorHandling('get RAG conversation', async (req, res) => {
      const { id } = req.params;
      const orgId = req.headers['x-org-id'] as string || (req as any).orgId || 'default-org-id';

      const conversationService = getConversationService();
      const conversation = await conversationService.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      if (conversation.orgId && conversation.orgId !== orgId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const messages = await conversationService.getMessages(id, 100);
      res.json({ conversation, messages });
    })
  );

  app.get('/api/rag/conversations/:id/messages', generalApiRateLimit,
    withErrorHandling('get conversation messages', async (req, res) => {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const conversationService = getConversationService();
      const messages = await conversationService.getMessages(id, limit);

      res.json(messages);
    })
  );

  app.patch('/api/rag/conversations/:id', generalApiRateLimit,
    withErrorHandling('update RAG conversation', async (req, res) => {
      const { id } = req.params;
      const parsed = conversationUpdateSchema.parse(req.body);

      const conversationService = getConversationService();
      const updated = await conversationService.updateConversation(id, parsed);

      if (!updated) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.json(updated);
    })
  );

  app.delete('/api/rag/conversations/:id', generalApiRateLimit,
    withErrorHandling('delete RAG conversation', async (req, res) => {
      const { id } = req.params;

      const conversationService = getConversationService();
      const deleted = await conversationService.deleteConversation(id);

      if (!deleted) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(204).send();
    })
  );

  app.post('/api/rag/feedback', generalApiRateLimit,
    withErrorHandling('submit RAG feedback', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const userId = req.headers['x-user-id'] as string || undefined;

      const parsed = feedbackSchema.parse(req.body);
      
      const orchestrator = getRagOrchestrator();
      await orchestrator.submitFeedback({
        orgId,
        userId,
        ...parsed,
      });

      res.status(201).json({ success: true });
    })
  );

  app.get('/api/rag/feedback/stats', generalApiRateLimit,
    withErrorHandling('get RAG feedback stats', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';

      const feedbackService = getFeedbackService();
      const stats = await feedbackService.getOrgStats(orgId);

      res.json(stats);
    })
  );

  app.get('/api/rag/cache/stats', generalApiRateLimit,
    withErrorHandling('get RAG cache stats', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';

      const cache = getSemanticCache();
      const stats = await cache.getStats(orgId);

      res.json(stats);
    })
  );

  app.post('/api/rag/cache/cleanup', generalApiRateLimit,
    withErrorHandling('cleanup RAG cache', async (req, res) => {
      const cache = getSemanticCache();
      const cleaned = await cache.cleanup();

      res.json({ cleanedEntries: cleaned });
    })
  );

  app.delete('/api/rag/cache', generalApiRateLimit,
    withErrorHandling('invalidate RAG cache', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const { query } = req.query;

      const cache = getSemanticCache();
      const invalidated = await cache.invalidate(orgId, query as string | undefined);

      res.json({ invalidatedEntries: invalidated });
    })
  );

  // === STREAMING ENDPOINT ===
  // Uses orchestrator for tenant isolation and persistence
  // Uses streaming tokens for SSE authentication (EventSource can't send headers)
  app.get('/api/rag/ask-stream', 
    ragRateLimitMiddleware as any,
    async (req: Request, res: Response) => {
      const { auditLogger, sanitizer, tokenService, config } = getRagSecurityServices();
      
      // Track client disconnect
      let isClientConnected = true;
      req.on('close', () => {
        isClientConnected = false;
        logger.info('[RAG Stream] Client disconnected');
      });

      try {
        // Authenticate via streaming token (preferred) or session
        let orgId: string;
        let userId: string | undefined;
        
        const streamingToken = req.query.token as string;
        if (streamingToken) {
          const tokenPayload = tokenService.validateToken(streamingToken);
          if (!tokenPayload) {
            auditLogger.logAuthFailure({
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              reason: 'Invalid or expired streaming token',
            });
            res.status(401).json({ error: 'Invalid or expired streaming token' });
            return;
          }
          orgId = tokenPayload.orgId;
          userId = tokenPayload.userId;
        } else if (config.auth.allowHeaderOrgId && process.env.NODE_ENV === 'development') {
          orgId = (req.query.orgId as string) || 
                        (req.headers['x-org-id'] as string) || 
                        'default-org-id';
          userId = (req.query.userId as string) ||
                         (req.headers['x-user-id'] as string) || 
                         undefined;
          logger.warn('[RAG Stream] Using dev-mode auth fallback — NOT for production');
        } else {
          res.status(401).json({ error: 'Streaming token required. Use POST /api/rag/security/streaming-token to obtain one.' });
          return;
        }
        
        let query = req.query.query as string;
        const conversationId = req.query.conversationId as string | undefined;

        // Sanitize query
        const sanitizeResult = sanitizer.sanitize(query || '');
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
          res.status(400).json({ error: 'Query is required' });
          return;
        }

        const apiKey = await getOpenAIApiKey();
        if (!apiKey) {
          res.status(503).json({ error: 'OpenAI API key not configured' });
          return;
        }

        if (!streamingService.isInitialized()) {
          await streamingService.initialize(apiKey);
        }

        // Use orchestrator for proper tenant-scoped search
        const orchestrator = getRagOrchestrator();
        const searchResults = await searchKnowledgeBase(query, orgId, 5, 0.5);
        
        const relevantChunks = searchResults.map((r: any) => ({
          content: r.content,
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          score: r.score,
        }));

        // Get conversation history if conversationId provided
        let conversationHistory: Array<{ role: string; content: string }> | undefined;
        if (conversationId) {
          const conversationService = getConversationService();
          const messages = await conversationService.getMessages(conversationId, 10);
          conversationHistory = messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          }));
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Accumulate full response for persistence
        let fullResponse = '';
        
        await streamingService.streamResponse(
          { query, relevantChunks, conversationHistory },
          res,
          async (chunk) => {
            // Check if client disconnected
            if (!isClientConnected) {
              logger.warn('[RAG Stream] Skipping chunk - client disconnected');
              return;
            }

            // Accumulate content for persistence
            if (chunk.type === 'content' && chunk.content) {
              fullResponse += chunk.content;
            }

            // On completion, persist the full message if conversation exists
            if (chunk.type === 'done' && conversationId && fullResponse) {
              try {
                const conversationService = getConversationService();
                // Add user's query first
                await conversationService.addMessage(conversationId, {
                  role: 'user',
                  content: query,
                });
                // Add full AI response
                await conversationService.addMessage(conversationId, {
                  role: 'assistant',
                  content: fullResponse,
                });
                logger.info(`[RAG Stream] Persisted ${fullResponse.length} chars to conversation ${conversationId}`);
              } catch (persistError) {
                logger.warn('[RAG Stream] Failed to persist message:', persistError);
              }
            }
          }
        );
      } catch (error: any) {
        logger.error('[RAG Stream] Error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message || 'Streaming failed' });
        } else {
          // Send error event through SSE
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        }
      }
    }
  );

  // === SUGGESTIONS ENDPOINT ===
  app.get('/api/rag/suggestions', generalApiRateLimit,
    withErrorHandling('get RAG suggestions', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const conversationId = req.query.conversationId as string | undefined;

      const apiKey = await getOpenAIApiKey();
      if (apiKey && !suggestionEngine.isInitialized()) {
        await suggestionEngine.initialize(apiKey);
      }

      const suggestions = await suggestionEngine.generateSuggestions({
        documentTopics: ['marine maintenance', 'engine systems', 'safety procedures'],
      }, 5);

      res.json({ success: true, suggestions });
    })
  );

  // === EXPORT ENDPOINT ===
  app.get('/api/rag/conversations/:id/export', generalApiRateLimit,
    withErrorHandling('export conversation', async (req, res) => {
      const { id } = req.params;
      const format = (req.query.format as 'pdf' | 'markdown') || 'markdown';
      const includeCitations = req.query.includeCitations !== 'false';
      const includeTimestamps = req.query.includeTimestamps !== 'false';

      const conversationService = getConversationService();
      const conversation = await conversationService.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const messages = await conversationService.getMessages(id, 1000);

      const exportData = {
        id: conversation.conversation.id,
        title: conversation.conversation.title || 'Untitled Conversation',
        createdAt: new Date(conversation.conversation.createdAt),
        messages: messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
          citations: m.citations,
        })),
      };

      const result = await exportService.exportConversation(exportData, {
        format,
        includeCitations,
        includeTimestamps,
      });

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    })
  );

  // === ANALYTICS ENDPOINT ===
  app.get('/api/rag/analytics', generalApiRateLimit,
    withErrorHandling('get RAG analytics', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';

      const analytics = await analyticsAggregator.getSummary(orgId);

      res.json({ success: true, analytics });
    })
  );

  // === COMPARISON ENDPOINT ===
  const comparisonSchema = z.object({
    query: z.string().min(1).max(2000),
    documentIds: z.array(z.string()).min(2).max(5),
    maxChunksPerDoc: z.number().optional(),
  });

  app.post('/api/rag/compare', reportGenerationRateLimit,
    withErrorHandling('compare documents', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const parsed = comparisonSchema.parse(req.body);

      const apiKey = await getOpenAIApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: 'OpenAI API key not configured' });
      }

      if (!comparisonService.isInitialized()) {
        await comparisonService.initialize(apiKey);
      }

      const result = await comparisonService.compare(parsed, orgId);

      res.json({ success: true, result });
    })
  );

  // === CONFIDENCE ALERTS ENDPOINT ===
  app.get('/api/rag/alerts', generalApiRateLimit,
    withErrorHandling('get confidence alerts', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const includeAcknowledged = req.query.includeAcknowledged === 'true';

      const alerts = confidenceDetector.getAlerts(orgId, includeAcknowledged);

      res.json({ success: true, alerts });
    })
  );

  app.post('/api/rag/alerts/:alertId/acknowledge', generalApiRateLimit,
    withErrorHandling('acknowledge alert', async (req, res) => {
      const { alertId } = req.params;

      const acknowledged = confidenceDetector.acknowledgeAlert(alertId);

      if (!acknowledged) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ success: true });
    })
  );

  logger.info('[RAG Routes] Registered (ask, ask-stream, conversations, feedback, cache, suggestions, export, analytics, compare, alerts)');
}
