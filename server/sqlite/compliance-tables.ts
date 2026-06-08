/**
 * SQLite Compliance Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getComplianceTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS compliance_findings (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT NOT NULL, vessel_id TEXT, log_date TEXT, source_type TEXT NOT NULL, rule_code TEXT, rule_name TEXT, category TEXT, severity TEXT NOT NULL DEFAULT 'warning', title TEXT, description TEXT, message TEXT, context TEXT, linked_deck_log_day_id TEXT, linked_engine_log_day_id TEXT, linked_equipment_ids TEXT, linked_work_order_ids TEXT, linked_crew_ids TEXT, linked_alert_ids TEXT, status TEXT NOT NULL DEFAULT 'open', archived_at INTEGER, archived_by TEXT, acknowledged_at INTEGER, acknowledged_by_user_id TEXT, acknowledged_by_user_name TEXT, resolved_at INTEGER, resolved_by_user_id TEXT, resolved_by_user_name TEXT, resolution_notes TEXT, suppressed_until INTEGER, suppressed_reason TEXT, notification_sent_at INTEGER, notification_recipients TEXT, found_at INTEGER DEFAULT (unixepoch() * 1000), created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000))`,
    sql`CREATE TABLE IF NOT EXISTS compliance_rules (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT NOT NULL, rule_code TEXT NOT NULL, rule_name TEXT NOT NULL, description TEXT, source_type TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'warning', rule_type TEXT, rule_config TEXT, notify_on_trigger INTEGER DEFAULT 1, notify_roles TEXT, notify_emails TEXT, enabled INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch() * 1000), updated_at INTEGER DEFAULT (unixepoch() * 1000))`,
  ];
}

export function getComplianceIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_org ON compliance_findings(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_vessel ON compliance_findings(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_date ON compliance_findings(log_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_source ON compliance_findings(source_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_status ON compliance_findings(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_findings_rule ON compliance_findings(rule_code)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_rules_org ON compliance_rules(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_rules_code ON compliance_rules(rule_code)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_rules_source ON compliance_rules(source_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_compliance_rules_enabled ON compliance_rules(enabled)`,
  ];
}
