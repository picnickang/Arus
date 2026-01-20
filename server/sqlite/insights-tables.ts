/**
 * SQLite Insights & LLM Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function getInsightsTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS actionable_insights (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT, vessel_id TEXT, insight_type TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, description TEXT, recommended_actions TEXT, estimated_impact TEXT, confidence_score REAL, data_sources TEXT, expires_at INTEGER, acknowledged INTEGER DEFAULT 0, acknowledged_by TEXT, acknowledged_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS insight_reports (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, report_type TEXT NOT NULL, title TEXT NOT NULL, content TEXT, summary TEXT, generated_by TEXT, vessel_id TEXT, equipment_ids TEXT, date_range_start INTEGER, date_range_end INTEGER, status TEXT DEFAULT 'draft', pdf_path TEXT, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS insight_snapshots (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, snapshot_type TEXT NOT NULL, snapshot_date INTEGER NOT NULL, data TEXT NOT NULL, metadata TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS visualization_assets (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, report_id TEXT, asset_type TEXT NOT NULL, asset_name TEXT NOT NULL, file_path TEXT, mime_type TEXT, file_size INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS cost_savings (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, equipment_id TEXT, vessel_id TEXT, work_order_id TEXT, saving_type TEXT NOT NULL, amount REAL NOT NULL, currency TEXT DEFAULT 'SGD', description TEXT, calculation_basis TEXT, period_start INTEGER, period_end INTEGER, verified INTEGER DEFAULT 0, verified_by TEXT, verified_at INTEGER, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS llm_budget_configs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, daily_limit REAL, monthly_limit REAL, current_daily_usage REAL DEFAULT 0, current_monthly_usage REAL DEFAULT 0, last_reset_at INTEGER, alert_threshold_percent REAL DEFAULT 80, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS llm_cost_tracking (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, model TEXT NOT NULL, prompt_tokens INTEGER NOT NULL, completion_tokens INTEGER NOT NULL, total_tokens INTEGER NOT NULL, estimated_cost REAL NOT NULL, request_type TEXT, context TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS knowledge_base_items (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT, tags TEXT, source_type TEXT, source_ref TEXT, embedding TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS rag_search_queries (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, query TEXT NOT NULL, results_count INTEGER, top_result_id TEXT, relevance_score REAL, user_id TEXT, created_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS content_sources (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, source_type TEXT NOT NULL, source_name TEXT NOT NULL, source_url TEXT, sync_frequency TEXT, last_sync_at INTEGER, sync_status TEXT DEFAULT 'pending', item_count INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
  ];
}

export function getInsightsIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_actionable_insights_org ON actionable_insights(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_actionable_insights_equipment ON actionable_insights(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_insight_reports_org ON insight_reports(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_insight_snapshots_type ON insight_snapshots(snapshot_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_cost_savings_org ON cost_savings(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_llm_cost_tracking_org ON llm_cost_tracking(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_knowledge_base_items_org ON knowledge_base_items(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rag_search_queries_org ON rag_search_queries(org_id)`,
  ];
}
