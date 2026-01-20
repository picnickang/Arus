/**
 * RAG Prometheus Metrics
 * 
 * Provides comprehensive observability for the RAG system including:
 * - Query latency histograms
 * - Cache hit/miss rates
 * - Feedback scores
 * - Token usage tracking
 * - Error rates by type
 */

import { Counter, Histogram, Gauge, register } from 'prom-client';

const METRIC_PREFIX = 'arus_rag_';

export const ragQueryDuration = new Histogram({
  name: `${METRIC_PREFIX}query_duration_seconds`,
  help: 'Duration of RAG query processing in seconds',
  labelNames: ['operation', 'model', 'cache_hit'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
});

export const ragQueriesTotal = new Counter({
  name: `${METRIC_PREFIX}queries_total`,
  help: 'Total number of RAG queries processed',
  labelNames: ['org_id', 'status'] as const,
});

export const ragCacheHits = new Counter({
  name: `${METRIC_PREFIX}cache_hits_total`,
  help: 'Total number of RAG cache hits',
  labelNames: ['cache_type'] as const,
});

export const ragCacheMisses = new Counter({
  name: `${METRIC_PREFIX}cache_misses_total`,
  help: 'Total number of RAG cache misses',
  labelNames: ['cache_type'] as const,
});

export const ragCacheSize = new Gauge({
  name: `${METRIC_PREFIX}cache_size`,
  help: 'Current number of entries in the semantic cache',
  labelNames: ['org_id'] as const,
});

export const ragTokensUsed = new Counter({
  name: `${METRIC_PREFIX}tokens_used_total`,
  help: 'Total tokens used in RAG operations',
  labelNames: ['type', 'model'] as const,
});

export const ragFeedbackScore = new Histogram({
  name: `${METRIC_PREFIX}feedback_score`,
  help: 'User feedback scores for RAG responses',
  labelNames: ['feedback_type'] as const,
  buckets: [1, 2, 3, 4, 5],
});

export const ragFeedbackTotal = new Counter({
  name: `${METRIC_PREFIX}feedback_total`,
  help: 'Total feedback submissions',
  labelNames: ['feedback_type', 'rating'] as const,
});

export const ragDocumentsRetrieved = new Histogram({
  name: `${METRIC_PREFIX}documents_retrieved`,
  help: 'Number of documents retrieved per query',
  labelNames: ['org_id'] as const,
  buckets: [0, 1, 2, 3, 5, 10, 20],
});

export const ragConversationsActive = new Gauge({
  name: `${METRIC_PREFIX}conversations_active`,
  help: 'Number of active RAG conversations',
  labelNames: ['org_id'] as const,
});

export const ragErrors = new Counter({
  name: `${METRIC_PREFIX}errors_total`,
  help: 'Total number of RAG errors',
  labelNames: ['error_type', 'operation'] as const,
});

export const ragContextWindowUsage = new Histogram({
  name: `${METRIC_PREFIX}context_window_usage`,
  help: 'Percentage of context window used',
  labelNames: ['model'] as const,
  buckets: [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1.0],
});

export const ragSearchDuration = new Histogram({
  name: `${METRIC_PREFIX}search_duration_seconds`,
  help: 'Duration of knowledge base search operations',
  labelNames: ['search_type'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export interface RagMetricsSnapshot {
  queriesTotal: number;
  cacheHitRate: number;
  avgQueryDurationMs: number;
  avgFeedbackScore: number;
  activeConversations: number;
  errorsTotal: number;
}

export class RagMetricsCollector {
  recordQueryStart(): () => void {
    const startTime = Date.now();
    return () => startTime;
  }

  recordQueryComplete(
    durationMs: number,
    options: {
      orgId: string;
      model: string;
      cacheHit: boolean;
      status: 'success' | 'error';
      documentsRetrieved?: number;
      tokensUsed?: { prompt: number; completion: number };
    }
  ): void {
    const { orgId, model, cacheHit, status, documentsRetrieved, tokensUsed } = options;

    ragQueryDuration.observe(
      { operation: 'query', model, cache_hit: String(cacheHit) },
      durationMs / 1000
    );

    ragQueriesTotal.inc({ org_id: orgId, status });

    if (cacheHit) {
      ragCacheHits.inc({ cache_type: 'semantic' });
    } else {
      ragCacheMisses.inc({ cache_type: 'semantic' });
    }

    if (documentsRetrieved !== undefined) {
      ragDocumentsRetrieved.observe({ org_id: orgId }, documentsRetrieved);
    }

    if (tokensUsed) {
      ragTokensUsed.inc({ type: 'prompt', model }, tokensUsed.prompt);
      ragTokensUsed.inc({ type: 'completion', model }, tokensUsed.completion);
    }
  }

  recordCacheOperation(
    operation: 'hit' | 'miss',
    cacheType: 'exact' | 'semantic' = 'semantic'
  ): void {
    if (operation === 'hit') {
      ragCacheHits.inc({ cache_type: cacheType });
    } else {
      ragCacheMisses.inc({ cache_type: cacheType });
    }
  }

  recordFeedback(
    feedbackType: 'helpful' | 'not_helpful' | 'relevant' | 'irrelevant',
    rating?: number
  ): void {
    ragFeedbackTotal.inc({
      feedback_type: feedbackType,
      rating: rating?.toString() || 'none',
    });

    if (rating !== undefined) {
      ragFeedbackScore.observe({ feedback_type: feedbackType }, rating);
    }
  }

  recordError(errorType: string, operation: string): void {
    ragErrors.inc({ error_type: errorType, operation });
  }

  recordSearchDuration(durationMs: number, searchType: 'vector' | 'hybrid' | 'bm25'): void {
    ragSearchDuration.observe({ search_type: searchType }, durationMs / 1000);
  }

  updateActiveConversations(orgId: string, count: number): void {
    ragConversationsActive.set({ org_id: orgId }, count);
  }

  updateCacheSize(orgId: string, size: number): void {
    ragCacheSize.set({ org_id: orgId }, size);
  }

  recordContextUsage(model: string, usagePercent: number): void {
    ragContextWindowUsage.observe({ model }, usagePercent);
  }
}

export const ragMetrics = new RagMetricsCollector();

export function registerRagMetrics(): void {
  const metrics = [
    ragQueryDuration,
    ragQueriesTotal,
    ragCacheHits,
    ragCacheMisses,
    ragCacheSize,
    ragTokensUsed,
    ragFeedbackScore,
    ragFeedbackTotal,
    ragDocumentsRetrieved,
    ragConversationsActive,
    ragErrors,
    ragContextWindowUsage,
    ragSearchDuration,
  ];

  for (const metric of metrics) {
    try {
      register.registerMetric(metric);
    } catch (e) {
    }
  }
}
