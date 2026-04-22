/**
 * RAG Answer Generator Service
 * 
 * Generates answers to user queries using retrieved context from the knowledge base.
 * Features:
 * - OpenAI integration with model fallback
 * - Citation formatting and tracking
 * - Context window management
 * - Prometheus metrics integration
 */

import OpenAI from 'openai';
import { createOpenAIClient, analyzeErrorType } from '../../openai/client';
import { searchKnowledgeBase, type SearchResult } from '../../vector-search-service';
import type {
  RagAnswerRequest,
  RagAnswerResponse,
  Citation,
  ContextChunk,
  RagServiceConfig,
} from './types';
import { logger } from '../../utils/logger';

const SYSTEM_PROMPT_TEMPLATE = `You are a knowledgeable assistant for a marine fleet management system called ARUS. 
Your role is to answer questions about equipment maintenance, vessel operations, compliance, and related topics.

When answering:
1. Use ONLY the provided context to answer questions
2. If the context doesn't contain enough information, say so clearly
3. Cite your sources using [1], [2], etc. format matching the provided context numbers
4. Be concise but thorough
5. For technical questions, provide specific details and measurements when available
6. For compliance questions, reference specific regulations when mentioned in the context

Context from knowledge base:
{context}`;

const NO_CONTEXT_RESPONSE = `I don't have enough information in the knowledge base to answer that question accurately. 
You may want to:
- Rephrase your question
- Upload relevant documentation to the knowledge base
- Contact your fleet administrator for more information`;

export interface AnswerGeneratorConfig {
  model?: string;
  fallbackModel?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AnswerGenerator {
  private config: RagServiceConfig;

  constructor(config: Partial<RagServiceConfig> = {}) {
    this.config = {
      defaultModel: config.defaultModel || 'gpt-4o',
      fallbackModel: config.fallbackModel || 'gpt-4o-mini',
      maxTokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.3,
      maxSources: config.maxSources || 5,
      similarityThreshold: config.similarityThreshold || 0.1,
      cacheTtlSeconds: config.cacheTtlSeconds || 3600,
      cacheEnabled: config.cacheEnabled ?? true,
    };
  }

  async generateAnswer(request: RagAnswerRequest): Promise<RagAnswerResponse> {
    const startTime = Date.now();
    const {
      orgId,
      query,
      userId,
      userRoles,
      maxSources = this.config.maxSources,
      threshold = this.config.similarityThreshold,
      systemPrompt,
      temperature = this.config.temperature,
      maxTokens = this.config.maxTokens,
      modelOverride,
    } = request;

    logger.info(`[AnswerGenerator] Processing query for org ${orgId}: "${query.substring(0, 50)}..."`);

    const searchResults = await searchKnowledgeBase({
      orgId,
      query,
      limit: maxSources,
      threshold,
      visibilityFilter: userId || userRoles ? { userId, userRoles } : undefined,
    });

    if (searchResults.length === 0) {
      return {
        answer: NO_CONTEXT_RESPONSE,
        citations: [],
        sourceChunkIds: [],
        modelUsed: 'none',
        latencyMs: Date.now() - startTime,
        cached: false,
      };
    }

    const contextChunks = this.prepareContextChunks(searchResults);
    const contextText = this.formatContextForPrompt(contextChunks);
    const effectiveSystemPrompt = (systemPrompt || SYSTEM_PROMPT_TEMPLATE).replace('{context}', contextText);

    const openai = await createOpenAIClient();
    if (!openai) {
      throw new Error('OpenAI client unavailable - please configure API key');
    }

    let model = modelOverride || this.config.defaultModel;
    let response: OpenAI.Chat.Completions.ChatCompletion;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: effectiveSystemPrompt },
            { role: 'user', content: query },
          ],
          temperature,
          max_tokens: maxTokens,
        });

        const answer = response.choices[0]?.message?.content || '';
        const citations = this.extractCitationsFromAnswer(answer, contextChunks);
        const usedChunkIds = citations.map(c => c.chunkId);

        logger.info(`[AnswerGenerator] Generated answer with ${citations.length} citations using ${model}`);

        return {
          answer,
          citations,
          sourceChunkIds: usedChunkIds,
          modelUsed: model,
          tokenCount: response.usage?.total_tokens,
          latencyMs: Date.now() - startTime,
          cached: false,
        };
      } catch (error: any) {
        attempts++;
        const analysis = analyzeErrorType(error);

        if (!analysis.shouldRetry || attempts >= maxAttempts) {
          logger.error(`[AnswerGenerator] Failed after ${attempts} attempts:`, error);
          throw error;
        }

        if (analysis.fallbackModel && model !== analysis.fallbackModel) {
          logger.warn(`[AnswerGenerator] Falling back to ${analysis.fallbackModel}: ${analysis.recommendation}`);
          model = analysis.fallbackModel;
        }

        if (analysis.suggestedDelay) {
          await this.delay(analysis.suggestedDelay);
        }
      }
    }

    throw new Error('Failed to generate answer after maximum attempts');
  }

  private prepareContextChunks(searchResults: SearchResult[]): ContextChunk[] {
    return searchResults.map((result, index) => ({
      ...result,
      citationIndex: index + 1,
    }));
  }

  private formatContextForPrompt(chunks: ContextChunk[]): string {
    return chunks
      .map(chunk => {
        const header = `[${chunk.citationIndex}] From "${chunk.docName}" (relevance: ${(chunk.similarity * 100).toFixed(1)}%):`;
        return `${header}\n${chunk.text}\n`;
      })
      .join('\n---\n');
  }

  private extractCitationsFromAnswer(answer: string, chunks: ContextChunk[]): Citation[] {
    const citationPattern = /\[(\d+)\]/g;
    const usedIndices = new Set<number>();
    let match;

    while ((match = citationPattern.exec(answer)) !== null) {
      usedIndices.add(parseInt(match[1], 10));
    }

    const citations: Citation[] = [];
    for (const chunk of chunks) {
      if (usedIndices.has(chunk.citationIndex)) {
        citations.push({
          docId: chunk.docId,
          docName: chunk.docName,
          chunkId: chunk.chunkId,
          text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
          relevance: chunk.similarity,
          ord: chunk.ord,
        });
      }
    }

    if (citations.length === 0 && chunks.length > 0) {
      const topChunks = chunks.slice(0, Math.min(3, chunks.length));
      for (const chunk of topChunks) {
        citations.push({
          docId: chunk.docId,
          docName: chunk.docName,
          chunkId: chunk.chunkId,
          text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
          relevance: chunk.similarity,
          ord: chunk.ord,
        });
      }
    }

    return citations;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

let defaultInstance: AnswerGenerator | null = null;

export function getAnswerGenerator(config?: Partial<RagServiceConfig>): AnswerGenerator {
  if (!defaultInstance || config) {
    defaultInstance = new AnswerGenerator(config);
  }
  return defaultInstance;
}

export async function generateRagAnswer(request: RagAnswerRequest): Promise<RagAnswerResponse> {
  return getAnswerGenerator().generateAnswer(request);
}
