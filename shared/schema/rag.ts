/**
 * Schema RAG - Knowledge Base Document and Conversation Management
 * 
 * Complete schema definitions for the RAG (Retrieval-Augmented Generation) system:
 * - Document storage (kb_docs) with visibility controls
 * - Chunk storage (kb_chunks) with vector embeddings
 * - Document versioning (kb_doc_versions) for audit trail
 * - Embedding cache (kb_embedding_cache) for performance
 * - Conversations (rag_conversations) for multi-turn interactions
 * - Messages (rag_messages) for conversation history
 * - Feedback (rag_feedback) for relevance tracking
 * - Semantic cache (rag_semantic_cache) for query result caching
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  vector,
  index,
  createInsertSchema,
  z,
} from "./base";

// =============================================================================
// DOCUMENT STORAGE
// =============================================================================

export const kbDocs = pgTable("kb_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  equipmentId: varchar("equipment_id"),
  name: text("name").notNull(),
  source: text("source"),
  fileType: text("file_type"),
  sizeBytes: integer("size_bytes"),
  status: text("status").notNull().default("completed"),
  numChunks: integer("num_chunks").default(0),
  metadata: jsonb("metadata").default({}),
  uploadedBy: varchar("uploaded_by"),
  version: integer("version").notNull().default(1),
  visibility: text("visibility").notNull().default("org"),
  allowedRoles: text("allowed_roles").array(),
  summary: text("summary"),
  summaryEmbedding: vector("summary_embedding", { dimensions: 384 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_kb_docs_org").on(table.orgId),
  index("idx_kb_docs_equipment").on(table.equipmentId),
  index("idx_kb_docs_status").on(table.status),
  index("idx_kb_docs_file_type").on(table.fileType),
  index("idx_kb_docs_visibility").on(table.visibility),
  index("idx_kb_docs_created_at").on(table.createdAt),
]);

export const kbChunks = pgTable("kb_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  docId: varchar("doc_id").notNull(),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 384 }),
  ord: integer("ord").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_kb_chunks_doc_id").on(table.docId),
  index("idx_kb_chunks_ord").on(table.ord),
]);

export const kbDocVersions = pgTable("kb_doc_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  docId: varchar("doc_id").notNull(),
  version: integer("version").notNull(),
  changeType: text("change_type").notNull(),
  changedBy: varchar("changed_by"),
  previousMetadata: jsonb("previous_metadata"),
  changeNotes: text("change_notes"),
  sizeBytes: integer("size_bytes"),
  numChunks: integer("num_chunks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_kb_doc_versions_doc_id").on(table.docId),
  index("idx_kb_doc_versions_version").on(table.docId, table.version),
  index("idx_kb_doc_versions_created_at").on(table.createdAt),
]);

export const kbEmbeddingCache = pgTable("kb_embedding_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  textHash: varchar("text_hash", { length: 64 }).notNull(),
  embedding: vector("embedding", { dimensions: 384 }).notNull(),
  hitCount: integer("hit_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
}, (table) => [
  index("idx_kb_cache_hash").on(table.textHash),
  index("idx_kb_cache_org_hash").on(table.orgId, table.textHash),
  index("idx_kb_cache_last_accessed").on(table.lastAccessedAt),
]);

// =============================================================================
// CONVERSATION MANAGEMENT
// =============================================================================

export const ragConversations = pgTable("rag_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  userId: varchar("user_id"),
  title: text("title"),
  context: jsonb("context").default({}),
  messageCount: integer("message_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_rag_conv_org").on(table.orgId),
  index("idx_rag_conv_user").on(table.userId),
  index("idx_rag_conv_active").on(table.isActive),
  index("idx_rag_conv_last_msg").on(table.lastMessageAt),
]);

export const ragMessages = pgTable("rag_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  sourceChunkIds: text("source_chunk_ids").array(),
  citations: jsonb("citations").default([]),
  tokenCount: integer("token_count"),
  modelUsed: varchar("model_used"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_rag_msg_conv").on(table.conversationId),
  index("idx_rag_msg_role").on(table.role),
  index("idx_rag_msg_created").on(table.createdAt),
]);

// =============================================================================
// FEEDBACK & RELEVANCE
// =============================================================================

export const ragFeedback = pgTable("rag_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  messageId: varchar("message_id"),
  chunkId: varchar("chunk_id"),
  userId: varchar("user_id"),
  feedbackType: text("feedback_type").notNull(),
  rating: integer("rating"),
  comment: text("comment"),
  queryText: text("query_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_rag_fb_org").on(table.orgId),
  index("idx_rag_fb_message").on(table.messageId),
  index("idx_rag_fb_chunk").on(table.chunkId),
  index("idx_rag_fb_type").on(table.feedbackType),
]);

// =============================================================================
// SEMANTIC CACHE
// =============================================================================

export const ragSemanticCache = pgTable("rag_semantic_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  queryHash: varchar("query_hash", { length: 64 }).notNull(),
  queryText: text("query_text").notNull(),
  queryEmbedding: vector("query_embedding", { dimensions: 384 }).notNull(),
  response: text("response").notNull(),
  sourceChunkIds: text("source_chunk_ids").array(),
  citations: jsonb("citations").default([]),
  modelUsed: varchar("model_used"),
  hitCount: integer("hit_count").notNull().default(1),
  ttlSeconds: integer("ttl_seconds").default(86400), // Cache TTL (24 hours default)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_rag_cache_org").on(table.orgId),
  index("idx_rag_cache_hash").on(table.queryHash),
  index("idx_rag_cache_expires").on(table.expiresAt),
  index("idx_rag_cache_accessed").on(table.lastAccessedAt),
]);

// =============================================================================
// INSERT SCHEMAS
// =============================================================================

export const insertKbDocSchema = createInsertSchema(kbDocs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKbChunkSchema = createInsertSchema(kbChunks).omit({
  id: true,
  createdAt: true,
});

export const insertKbDocVersionSchema = createInsertSchema(kbDocVersions).omit({
  id: true,
  createdAt: true,
});

export const insertRagConversationSchema = createInsertSchema(ragConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRagMessageSchema = createInsertSchema(ragMessages).omit({
  id: true,
  createdAt: true,
});

export const insertRagFeedbackSchema = createInsertSchema(ragFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertRagSemanticCacheSchema = createInsertSchema(ragSemanticCache).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

// =============================================================================
// TYPES
// =============================================================================

export type KbDoc = typeof kbDocs.$inferSelect;
export type InsertKbDoc = z.infer<typeof insertKbDocSchema>;

export type KbChunk = typeof kbChunks.$inferSelect;
export type InsertKbChunk = z.infer<typeof insertKbChunkSchema>;

export type KbDocVersion = typeof kbDocVersions.$inferSelect;
export type InsertKbDocVersion = z.infer<typeof insertKbDocVersionSchema>;

export type RagConversation = typeof ragConversations.$inferSelect;
export type InsertRagConversation = z.infer<typeof insertRagConversationSchema>;

export type RagMessage = typeof ragMessages.$inferSelect;
export type InsertRagMessage = z.infer<typeof insertRagMessageSchema>;

export type RagFeedback = typeof ragFeedback.$inferSelect;
export type InsertRagFeedback = z.infer<typeof insertRagFeedbackSchema>;

export type RagSemanticCache = typeof ragSemanticCache.$inferSelect;
export type InsertRagSemanticCache = z.infer<typeof insertRagSemanticCacheSchema>;

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const DocumentVisibility = {
  ORG: 'org',
  PRIVATE: 'private',
  ROLE_BASED: 'role-based',
} as const;
export type DocumentVisibilityType = typeof DocumentVisibility[keyof typeof DocumentVisibility];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type MessageRoleType = typeof MessageRole[keyof typeof MessageRole];

export const FeedbackType = {
  HELPFUL: 'helpful',
  NOT_HELPFUL: 'not_helpful',
  INACCURATE: 'inaccurate',
  MISSING_INFO: 'missing_info',
  OUTDATED: 'outdated',
} as const;
export type FeedbackTypeValue = typeof FeedbackType[keyof typeof FeedbackType];

export const DocChangeType = {
  CREATED: 'created',
  UPDATED: 'updated',
  REPROCESSED: 'reprocessed',
  VISIBILITY_CHANGED: 'visibility_changed',
  METADATA_UPDATED: 'metadata_updated',
} as const;
export type DocChangeTypeValue = typeof DocChangeType[keyof typeof DocChangeType];
