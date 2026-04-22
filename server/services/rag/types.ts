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
  conversationId?: string;
  userId?: string;
  userRoles?: string[];
  maxSources?: number;
  threshold?: number;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  modelOverride?: string;
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
  metadata?: Record<string, any>;
}

export interface QueryRewriteResult {
  originalQuery: string;
  rewrittenQuery: string;
  expandedQueries?: string[];
  intent?: string;
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
  expiresAt?: Date;
}

export interface FeedbackInput {
  orgId: string;
  messageId?: string;
  chunkId?: string;
  userId?: string;
  feedbackType: "helpful" | "not_helpful" | "inaccurate" | "missing_info" | "outdated";
  rating?: number;
  comment?: string;
  queryText?: string;
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
}
