/**
 * SQLite Hub Sync Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getSyncTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS replay_incoming (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, event_type TEXT NOT NULL, payload TEXT NOT NULL, source_device TEXT, received_at INTEGER NOT NULL, processed INTEGER DEFAULT 0, processed_at INTEGER, error_message TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sheet_lock (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, sheet_type TEXT NOT NULL, sheet_key TEXT, token TEXT, holder TEXT, expires_at INTEGER NOT NULL, reason TEXT)`,
    sql`CREATE TABLE IF NOT EXISTS sheet_version (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, sheet_type TEXT NOT NULL, sheet_key TEXT, version INTEGER NOT NULL DEFAULT 1, last_modified INTEGER, last_modified_by TEXT, data TEXT, changed_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS sync_conflicts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, local_version TEXT, remote_version TEXT, conflict_type TEXT NOT NULL, resolution_status TEXT DEFAULT 'pending', resolved_by TEXT, resolved_at INTEGER, resolution_notes TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS transport_failovers (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, primary_transport TEXT NOT NULL, fallback_transport TEXT NOT NULL, failover_reason TEXT, failover_at INTEGER NOT NULL, recovered_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS transport_settings (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, transport_type TEXT NOT NULL, settings TEXT, is_primary INTEGER DEFAULT 0, is_enabled INTEGER DEFAULT 1, priority INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS ops_db_staged (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, operation_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, payload TEXT, staged_at INTEGER NOT NULL, applied_at INTEGER, status TEXT DEFAULT 'pending', error_message TEXT)`,
    sql`CREATE TABLE IF NOT EXISTS beast_mode_config (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'normal', started_at INTEGER, started_by TEXT, reason TEXT, auto_disable_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getSyncIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_replay_incoming_processed ON replay_incoming(processed)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sheet_lock_sheet ON sheet_lock(sheet_type, sheet_key)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sheet_version_sheet ON sheet_version(sheet_type, sheet_key)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(resolution_status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_ops_db_staged_status ON ops_db_staged(status)`,
  ];
}
