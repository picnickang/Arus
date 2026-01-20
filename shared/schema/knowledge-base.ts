/**
 * Schema Knowledge Base - RAG Search and Content Management
 * 
 * Knowledge base items, RAG search queries, and content sources
 * for enhanced LLM report citations and semantic search.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  createInsertSchema,
  z,
} from "./base.js";

// RAG Search System: Knowledge base for enhanced LLM report citations
export const knowledgeBaseItems = pgTable("knowledge_base_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  contentType: varchar("content_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  summary: varchar("summary", { length: 500 }),
  metadata: jsonb("metadata").default({}),
  keywords: text("keywords").array(),
  relevanceScore: real("relevance_score").default(1),
  isActive: boolean("is_active").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// RAG Search Queries: Track search queries and results for optimization
export const ragSearchQueries = pgTable("rag_search_queries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  query: text("query").notNull(),
  searchType: varchar("search_type").notNull(),
  filters: jsonb("filters").default({}),
  resultCount: integer("result_count").default(0),
  executionTimeMs: integer("execution_time_ms"),
  resultIds: text("result_ids").array(),
  relevanceScores: real("relevance_scores").array(),
  reportContext: varchar("report_context"),
  aiModelUsed: varchar("ai_model_used"),
  successful: boolean("successful").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Content Source Mapping: Enhanced citations with data lineage
export const contentSources = pgTable("content_sources", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  sourceType: varchar("source_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  entityName: varchar("entity_name"),
  lastModified: timestamp("last_modified").defaultNow(),
  dataQuality: real("data_quality").default(1),
  accessLevel: varchar("access_level").default("public"),
  tags: text("tags").array(),
  relatedSources: text("related_sources").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertKnowledgeBaseItemSchema = createInsertSchema(knowledgeBaseItems).omit({
  id: true,
  createdAt: true,
});

export const insertRagSearchQuerySchema = createInsertSchema(ragSearchQueries).omit({
  id: true,
  createdAt: true,
});

export const insertContentSourceSchema = createInsertSchema(contentSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type KnowledgeBaseItem = typeof knowledgeBaseItems.$inferSelect;
export type InsertKnowledgeBaseItem = z.infer<typeof insertKnowledgeBaseItemSchema>;
export type RagSearchQuery = typeof ragSearchQueries.$inferSelect;
export type InsertRagSearchQuery = z.infer<typeof insertRagSearchQuerySchema>;
export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = z.infer<typeof insertContentSourceSchema>;
