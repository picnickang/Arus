/**
 * SQLite System & Admin Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getSystemTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS system_settings (id TEXT PRIMARY KEY DEFAULT 'system', hmac_required INTEGER DEFAULT 0, max_payload_bytes INTEGER DEFAULT 2097152, strict_units INTEGER DEFAULT 0, llm_enabled INTEGER DEFAULT 1, llm_model TEXT DEFAULT 'gpt-4o-mini', openai_api_key TEXT, openai_api_key_encrypted TEXT, ai_insights_throttle_minutes INTEGER DEFAULT 2, timestamp_tolerance_minutes INTEGER DEFAULT 5, org_id TEXT, setting_key TEXT, setting_value TEXT, setting_type TEXT DEFAULT 'string', description TEXT, is_sensitive INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS admin_system_settings (id TEXT PRIMARY KEY, org_id TEXT NOT NULL DEFAULT 'default-org-id', category TEXT NOT NULL DEFAULT 'general', "key" TEXT NOT NULL, value TEXT, data_type TEXT NOT NULL DEFAULT 'string', description TEXT, is_secret INTEGER DEFAULT 0, is_readonly INTEGER DEFAULT 0, validation_rule TEXT, default_value TEXT, updated_by TEXT, created_at INTEGER, updated_at INTEGER, UNIQUE(org_id, category, "key"))`,
    sql`CREATE TABLE IF NOT EXISTS admin_audit_events (id TEXT PRIMARY KEY, org_id TEXT, user_id TEXT, action TEXT NOT NULL, resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS error_logs (id TEXT PRIMARY KEY, org_id TEXT, timestamp INTEGER, category TEXT NOT NULL DEFAULT 'application', error_type TEXT NOT NULL DEFAULT 'application', error_code TEXT, message TEXT NOT NULL, stack_trace TEXT, context TEXT, user_id TEXT, request_id TEXT, endpoint TEXT, severity TEXT NOT NULL DEFAULT 'error', resolved INTEGER DEFAULT 0, resolved_by TEXT, resolved_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS integration_configs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, integration_type TEXT NOT NULL, integration_name TEXT NOT NULL, config TEXT, credentials TEXT, is_active INTEGER DEFAULT 1, last_sync_at INTEGER, sync_status TEXT DEFAULT 'pending', error_message TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS update_settings (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, auto_update INTEGER DEFAULT 1, update_channel TEXT DEFAULT 'stable', last_check_at INTEGER, last_update_at INTEGER, current_version TEXT, available_version TEXT, update_notes TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS compliance_audit_log (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, audit_type TEXT NOT NULL, entity_type TEXT, entity_id TEXT, action TEXT NOT NULL, actor TEXT, details TEXT, compliance_status TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS compliance_bundles (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, bundle_type TEXT NOT NULL, bundle_name TEXT NOT NULL, date_range_start INTEGER, date_range_end INTEGER, vessel_id TEXT, file_path TEXT, file_size INTEGER, checksum TEXT, generated_by TEXT, status TEXT DEFAULT 'pending', created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS immutable_audit_trail (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, event_category TEXT, event_type TEXT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, previous_state TEXT, new_state TEXT, changed_fields TEXT, performed_by TEXT, performed_by_type TEXT DEFAULT 'user', performed_by_name TEXT, performed_by_role TEXT, ip_address TEXT, device_id TEXT, vessel_id TEXT, event_timestamp TEXT, server_timestamp TEXT, prev_hash TEXT, hash TEXT NOT NULL, hash_version INTEGER NOT NULL DEFAULT 2, compliance_standard TEXT, retention_required INTEGER DEFAULT 1, retention_expires_at TEXT, metadata TEXT, action TEXT NOT NULL, data_hash TEXT NOT NULL, previous_hash TEXT, sequence_number INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
    sql`CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT, session_token TEXT NOT NULL, admin_email TEXT, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), expires_at INTEGER NOT NULL, last_activity_at INTEGER, is_active INTEGER DEFAULT 1)`,
    sql`CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, session_token TEXT NOT NULL, ip_address TEXT, user_agent TEXT, device_info TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_activity_at INTEGER, is_active INTEGER DEFAULT 1)`,
  ];
}

export function getSystemIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_ass_org_category_key ON admin_system_settings(org_id, category, "key")`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_events_org ON admin_audit_events(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_events_action ON admin_audit_events(action)`,
    sql`CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_integration_configs_org ON integration_configs(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_org ON compliance_audit_log(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_immutable_audit_trail_entity ON immutable_audit_trail(entity_type, entity_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token)`,
    sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`,
  ];
}
