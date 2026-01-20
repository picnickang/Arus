/**
 * RAG Query Rewriter Service
 * 
 * Uses LLM to expand and improve user queries for better retrieval.
 * Features:
 * - Query expansion for better recall
 * - Intent detection
 * - Spelling/grammar correction
 * - Domain-specific term normalization
 */

import { createOpenAIClient } from '../../openai/client';
import type { QueryRewriteResult } from './types';
import { logger } from '../../utils/logger';

const REWRITE_SYSTEM_PROMPT = `You are a query optimization assistant for a marine fleet management system.
Your task is to improve search queries for a knowledge base containing:
- Equipment manuals and maintenance procedures
- Vessel operation guidelines
- Compliance and regulatory documents
- Crew training materials
- Technical specifications

Given a user query, you must:
1. Fix any spelling or grammatical errors
2. Expand abbreviations (e.g., "PM" -> "preventive maintenance", "MARPOL" -> "MARPOL convention")
3. Add relevant synonyms or related terms
4. Identify the query intent

Respond in JSON format:
{
  "rewritten": "the improved main query",
  "expanded": ["alternative query 1", "alternative query 2"],
  "intent": "maintenance|compliance|operations|troubleshooting|general"
}`;

export interface QueryRewriterConfig {
  model?: string;
  enabled?: boolean;
  maxExpansions?: number;
}

export class QueryRewriter {
  private model: string;
  private enabled: boolean;
  private maxExpansions: number;

  constructor(config: QueryRewriterConfig = {}) {
    this.model = config.model || 'gpt-4o-mini';
    this.enabled = config.enabled ?? true;
    this.maxExpansions = config.maxExpansions || 3;
  }

  async rewrite(query: string): Promise<QueryRewriteResult> {
    if (!this.enabled) {
      return {
        originalQuery: query,
        rewrittenQuery: query,
      };
    }

    const openai = await createOpenAIClient();
    if (!openai) {
      logger.warn('[QueryRewriter] OpenAI unavailable, returning original query');
      return {
        originalQuery: query,
        rewrittenQuery: query,
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: REWRITE_SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const parsed = JSON.parse(content);
      
      logger.info(`[QueryRewriter] Rewrote "${query}" -> "${parsed.rewritten}"`);

      return {
        originalQuery: query,
        rewrittenQuery: parsed.rewritten || query,
        expandedQueries: (parsed.expanded || []).slice(0, this.maxExpansions),
        intent: parsed.intent,
      };
    } catch (error) {
      logger.error('[QueryRewriter] Failed to rewrite query:', error);
      return {
        originalQuery: query,
        rewrittenQuery: query,
      };
    }
  }

  async rewriteMultiple(queries: string[]): Promise<QueryRewriteResult[]> {
    return Promise.all(queries.map(q => this.rewrite(q)));
  }
}

let defaultInstance: QueryRewriter | null = null;

export function getQueryRewriter(config?: QueryRewriterConfig): QueryRewriter {
  if (!defaultInstance || config) {
    defaultInstance = new QueryRewriter(config);
  }
  return defaultInstance;
}

export async function rewriteQuery(query: string): Promise<QueryRewriteResult> {
  return getQueryRewriter().rewrite(query);
}
