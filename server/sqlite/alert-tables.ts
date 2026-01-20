/**
 * SQLite Alert Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getAlertTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS alert_configurations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, threshold_warning REAL, threshold_critical REAL, comparison_operator TEXT DEFAULT 'greater_than', is_enabled INTEGER DEFAULT 1, cooldown_minutes INTEGER DEFAULT 30, notification_channels TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS alert_notifications (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, alert_type TEXT NOT NULL, current_value REAL, threshold_value REAL, message TEXT, acknowledged INTEGER DEFAULT 0, acknowledged_by TEXT, acknowledged_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS alert_suppressions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, sensor_type TEXT NOT NULL, alert_type TEXT, suppressed_by TEXT NOT NULL, reason TEXT, suppress_until INTEGER NOT NULL, active INTEGER DEFAULT 1, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS alert_comments (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, alert_id TEXT NOT NULL, author TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS operating_condition_alerts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, condition_name TEXT NOT NULL, alert_type TEXT NOT NULL, message TEXT, detected_at INTEGER NOT NULL, resolved INTEGER DEFAULT 0, resolved_at INTEGER, resolved_by TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS pdm_alerts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT NOT NULL, prediction_id TEXT, alert_type TEXT NOT NULL, severity TEXT NOT NULL, message TEXT, recommended_action TEXT, estimated_rul_days REAL, confidence_score REAL, acknowledged INTEGER DEFAULT 0, acknowledged_by TEXT, acknowledged_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS alert_cooldowns (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT, vessel_id TEXT, sensor_type TEXT NOT NULL, alert_type TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'global', cooldown_minutes INTEGER NOT NULL DEFAULT 30, last_triggered INTEGER, next_allowed INTEGER, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getAlertIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_alert_configurations_equipment ON alert_configurations(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_alert_notifications_equipment ON alert_notifications(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_alert_notifications_acknowledged ON alert_notifications(acknowledged)`,
    sql`CREATE INDEX IF NOT EXISTS idx_alert_notifications_created ON alert_notifications(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_alert_suppressions_equipment ON alert_suppressions(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_operating_condition_alerts_equipment ON operating_condition_alerts(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_pdm_alerts_equipment ON pdm_alerts(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_alert_cooldowns_lookup ON alert_cooldowns(org_id, sensor_type, alert_type, scope)`,
  ];
}
