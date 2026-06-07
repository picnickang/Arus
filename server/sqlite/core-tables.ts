/**
 * SQLite Core Tables - Organizations, Users, Sync
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getCoreTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, domain TEXT, billing_email TEXT, max_users INTEGER DEFAULT 50, max_equipment INTEGER DEFAULT 1000, subscription_tier TEXT NOT NULL DEFAULT 'basic', is_active INTEGER DEFAULT 1, emergency_labor_multiplier INTEGER DEFAULT 3, emergency_parts_multiplier REAL DEFAULT 1.5, emergency_downtime_multiplier INTEGER DEFAULT 3, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer', is_active INTEGER DEFAULT 1, last_login_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sync_journal (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT, user_id TEXT, sync_status TEXT DEFAULT 'pending', created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sync_outbox (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload TEXT, processed INTEGER DEFAULT 0, processing_attempts INTEGER DEFAULT 0, created_at INTEGER, processed_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS db_schema_version (id INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER NOT NULL)`,
    sql`CREATE TABLE IF NOT EXISTS request_idempotency (key TEXT PRIMARY KEY, org_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT UNIQUE, response_status INTEGER, response_body TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
    sql`CREATE TABLE IF NOT EXISTS idempotency_log (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, created_at INTEGER NOT NULL)`,
  ];
}

export function getCoreIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_sync_journal_entity ON sync_journal(entity_type, entity_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sync_journal_status ON sync_journal(sync_status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sync_outbox_processed ON sync_outbox(processed)`,
    sql`CREATE INDEX IF NOT EXISTS idx_request_idempotency_hash ON request_idempotency(request_hash)`,
  ];
}
