/**
 * SQLite RAG Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

const textIdDefault = sql`(lower(hex(randomblob(16))))`;

export function getRagTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS kb_docs (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, equipment_id TEXT, name TEXT NOT NULL, source TEXT, file_type TEXT, size_bytes INTEGER, status TEXT NOT NULL DEFAULT 'completed', num_chunks INTEGER DEFAULT 0, metadata TEXT DEFAULT '{}', uploaded_by TEXT, version INTEGER NOT NULL DEFAULT 1, visibility TEXT NOT NULL DEFAULT 'org', allowed_roles TEXT, summary TEXT, summary_embedding TEXT, created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS kb_chunks (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, doc_id TEXT NOT NULL, text TEXT NOT NULL, embedding TEXT, ord INTEGER NOT NULL DEFAULT 0, created_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS kb_doc_versions (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, doc_id TEXT NOT NULL, version INTEGER NOT NULL, change_type TEXT NOT NULL, changed_by TEXT, previous_metadata TEXT, change_notes TEXT, size_bytes INTEGER, num_chunks INTEGER, created_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS kb_embedding_cache (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, text_hash TEXT NOT NULL, embedding TEXT NOT NULL, hit_count INTEGER NOT NULL DEFAULT 1, created_at INTEGER DEFAULT (unixepoch() * 1000), last_accessed_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS rag_conversations (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, user_id TEXT, title TEXT, context TEXT DEFAULT '{}', message_count INTEGER NOT NULL DEFAULT 0, last_message_at INTEGER, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS rag_messages (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, source_chunk_ids TEXT, citations TEXT DEFAULT '[]', token_count INTEGER, model_used TEXT, latency_ms INTEGER, created_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS rag_feedback (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, message_id TEXT, chunk_id TEXT, user_id TEXT, feedback_type TEXT NOT NULL, rating INTEGER, comment TEXT, query_text TEXT, created_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS rag_semantic_cache (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, query_hash TEXT NOT NULL, query_text TEXT NOT NULL, query_embedding TEXT NOT NULL, response TEXT NOT NULL, source_chunk_ids TEXT, citations TEXT DEFAULT '[]', model_used TEXT, hit_count INTEGER NOT NULL DEFAULT 1, ttl_seconds INTEGER DEFAULT 86400, created_at INTEGER DEFAULT (unixepoch() * 1000), last_accessed_at INTEGER DEFAULT (unixepoch() * 1000), expires_at INTEGER, UNIQUE(org_id, query_hash))`,
  ];
}

export function getRagIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_kb_docs_org ON kb_docs(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_docs_equipment ON kb_docs(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_docs_status ON kb_docs(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_docs_file_type ON kb_docs(file_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_docs_visibility ON kb_docs(visibility)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_docs_created_at ON kb_docs(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc_id ON kb_chunks(doc_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_chunks_ord ON kb_chunks(ord)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_doc_versions_doc_id ON kb_doc_versions(doc_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_doc_versions_version ON kb_doc_versions(doc_id, version)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_doc_versions_created_at ON kb_doc_versions(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_cache_hash ON kb_embedding_cache(text_hash)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_cache_org_hash ON kb_embedding_cache(org_id, text_hash)`,
    sql`CREATE INDEX IF NOT EXISTS idx_kb_cache_last_accessed ON kb_embedding_cache(last_accessed_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_conv_org ON rag_conversations(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_conv_user ON rag_conversations(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_conv_active ON rag_conversations(is_active)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_conv_last_msg ON rag_conversations(last_message_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_msg_conv ON rag_messages(conversation_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_msg_role ON rag_messages(role)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_msg_created ON rag_messages(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_fb_org ON rag_feedback(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_fb_message ON rag_feedback(message_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_fb_chunk ON rag_feedback(chunk_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_fb_type ON rag_feedback(feedback_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_cache_org ON rag_semantic_cache(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_cache_hash ON rag_semantic_cache(query_hash)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_cache_expires ON rag_semantic_cache(expires_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_cache_accessed ON rag_semantic_cache(last_accessed_at)`,
  ];
}
