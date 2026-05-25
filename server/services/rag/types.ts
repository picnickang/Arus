/**
 * RAG Service Types
 *
 * Shared type definitions for all RAG services.
 */

import type { SearchResult } from "../../vector-search-service";

export interface Citation {
  docId: string;
  docName: string;
  chunkId: string;
  text: string;
  relevance: number;
  ord: number;
}

export interface RagAnswerRequest {
  orgId: string;
  query: string;
  conversationId?: string | undefined;
  userId?: string | undefined;
  userRoles?: string[] | undefined;
  maxSources?: number | undefined;
  threshold?: number | undefined;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  modelOverride?: string | undefined;
}

export interface RagAnswerResponse {
  answer: string;
  citations: Citation[];
  sourceChunkIds: string[];
  modelUsed: string;
  tokenCount?: number;
  latencyMs: number;
  conversationId?: string;
  messageId?: string;
  cached: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  metadata?: Record<string, unknown>;
}

export interface QueryRewriteResult {
  originalQuery: string;
  rewrittenQuery: string;
  expandedQueries?: string[] | undefined;
  intent?: string | undefined;
}

export interface SemanticCacheEntry {
  queryHash: string;
  queryText: string;
  response: string;
  citations: Citation[];
  sourceChunkIds: string[];
  modelUsed: string;
  hitCount: number;
  createdAt: Date;
  expiresAt?: Date | undefined;
}

export interface FeedbackInput {
  orgId: string;
  messageId?: string | undefined;
  chunkId?: string | undefined;
  userId?: string | undefined;
  feedbackType: "helpful" | "not_helpful" | "inaccurate" | "missing_info" | "outdated";
  rating?: number | undefined;
  comment?: string | undefined;
  queryText?: string | undefined;
}

export interface RagServiceConfig {
  defaultModel: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
  maxSources: number;
  similarityThreshold: number;
  cacheTtlSeconds: number;
  cacheEnabled: boolean;
}

export const DEFAULT_RAG_CONFIG: RagServiceConfig = {
  defaultModel: "gpt-4o",
  fallbackModel: "gpt-4o-mini",
  maxTokens: 2048,
  temperature: 0.3,
  maxSources: 5,
  similarityThreshold: 0.1,
  cacheTtlSeconds: 3600,
  cacheEnabled: true,
};

export interface ContextChunk extends SearchResult {
  citationIndex: number;
  docId?: string;
  ord?: number;
  chunkId?: string;
}
