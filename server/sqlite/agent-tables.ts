/**
 * SQLite Agent Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

const textIdDefault = sql`(lower(hex(randomblob(16))))`;
const nowMsDefault = sql`(unixepoch() * 1000)`;

export function getAgentTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS agent_conversations (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, user_id TEXT, title TEXT, status TEXT NOT NULL DEFAULT 'active', message_count INTEGER NOT NULL DEFAULT 0, total_tokens_used INTEGER DEFAULT 0, last_message_at INTEGER, metadata TEXT DEFAULT '{}', context_summary TEXT, summarized_up_to INTEGER DEFAULT 0, created_at INTEGER DEFAULT ${nowMsDefault}, updated_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_messages (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT, tool_calls TEXT, token_count INTEGER, model TEXT, created_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_tool_calls (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, conversation_id TEXT NOT NULL, message_id TEXT NOT NULL, tool_name TEXT NOT NULL, input TEXT, output TEXT, status TEXT NOT NULL DEFAULT 'pending', duration_ms INTEGER, error TEXT, created_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_drafts (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, conversation_id TEXT NOT NULL, draft_type TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_by_id TEXT, reviewed_by_id TEXT, review_note TEXT, result_id TEXT, created_at INTEGER DEFAULT ${nowMsDefault}, updated_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_approvals (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, draft_id TEXT NOT NULL, conversation_id TEXT NOT NULL, action TEXT NOT NULL, reviewed_by_id TEXT, review_note TEXT, result_id TEXT, created_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_config (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, default_model TEXT NOT NULL DEFAULT 'gpt-4o-mini', max_iterations_per_run INTEGER NOT NULL DEFAULT 10, max_tokens_per_conversation INTEGER DEFAULT 50000, daily_token_limit INTEGER DEFAULT 500000, monthly_token_limit INTEGER DEFAULT 5000000, custom_system_prompt TEXT, enabled_tools TEXT, context_compaction INTEGER NOT NULL DEFAULT 1, compaction_threshold INTEGER NOT NULL DEFAULT 30, tool_output_char_limit INTEGER NOT NULL DEFAULT 4000, deferred_tool_loading INTEGER NOT NULL DEFAULT 1, permission_tier TEXT NOT NULL DEFAULT 'strict', auto_trigger_enabled INTEGER NOT NULL DEFAULT 0, auto_trigger_threshold REAL NOT NULL DEFAULT 0.85, suggestion_preferences TEXT, created_at INTEGER DEFAULT ${nowMsDefault}, updated_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_suggestions (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, trigger_type TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, entity_type TEXT, entity_id TEXT, severity TEXT NOT NULL DEFAULT 'info', status TEXT NOT NULL DEFAULT 'pending', context TEXT, acted_on INTEGER DEFAULT 0, outcome TEXT, outcome_reason TEXT, outcome_at INTEGER, outcome_by TEXT, linked_prediction_id TEXT, created_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_schedules (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, name TEXT NOT NULL, prompt TEXT NOT NULL, cron_expression TEXT NOT NULL, allowed_tools TEXT, output_destination TEXT NOT NULL DEFAULT 'notification', allow_write_tools INTEGER NOT NULL DEFAULT 0, max_token_budget INTEGER DEFAULT 4000, consecutive_failures INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, last_run_at INTEGER, created_at INTEGER DEFAULT ${nowMsDefault}, updated_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_schedule_runs (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, schedule_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', output TEXT, token_usage INTEGER, error TEXT, started_at INTEGER DEFAULT ${nowMsDefault}, completed_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS agent_files (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, conversation_id TEXT NOT NULL, filename TEXT NOT NULL, mimetype TEXT NOT NULL, size INTEGER NOT NULL, stored_path TEXT NOT NULL, created_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_briefings (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, generated_at INTEGER DEFAULT ${nowMsDefault}, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, sections TEXT NOT NULL DEFAULT '[]', ai_summary TEXT, status TEXT NOT NULL DEFAULT 'generating', schedule_run_id TEXT, created_at INTEGER DEFAULT ${nowMsDefault})`,
    sql`CREATE TABLE IF NOT EXISTS agent_tasks (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'open', priority TEXT NOT NULL DEFAULT 'medium', source TEXT NOT NULL DEFAULT 'user', parent_task_id TEXT, equipment_id TEXT, vessel_id TEXT, prediction_id TEXT, conversation_id TEXT, outcome TEXT, created_at INTEGER DEFAULT ${nowMsDefault}, updated_at INTEGER DEFAULT ${nowMsDefault}, completed_at INTEGER)`,
    sql`CREATE TABLE IF NOT EXISTS agent_findings (id TEXT PRIMARY KEY DEFAULT ${textIdDefault}, org_id TEXT NOT NULL, finding_type TEXT NOT NULL DEFAULT 'recommendation', severity TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, evidence_summary TEXT, recommended_action TEXT, status TEXT NOT NULL DEFAULT 'new', task_id TEXT, equipment_id TEXT, vessel_id TEXT, entity_type TEXT, entity_id TEXT, conversation_id TEXT, metadata TEXT DEFAULT '{}', created_at INTEGER DEFAULT ${nowMsDefault}, updated_at INTEGER DEFAULT ${nowMsDefault})`,
  ];
}

export function getAgentIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_agent_conv_org ON agent_conversations(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_conv_user ON agent_conversations(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_conv_status ON agent_conversations(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_conv_last_msg ON agent_conversations(last_message_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_msg_conv ON agent_messages(conversation_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_msg_role ON agent_messages(role)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_msg_created ON agent_messages(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tc_conv ON agent_tool_calls(conversation_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tc_msg ON agent_tool_calls(message_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tc_tool ON agent_tool_calls(tool_name)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tc_status ON agent_tool_calls(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_draft_org ON agent_drafts(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_draft_conv ON agent_drafts(conversation_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_draft_status ON agent_drafts(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_draft_type ON agent_drafts(draft_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_appr_org ON agent_approvals(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_appr_draft ON agent_approvals(draft_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_appr_conv ON agent_approvals(conversation_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_config_org ON agent_config(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sug_org ON agent_suggestions(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sug_status ON agent_suggestions(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sug_trigger ON agent_suggestions(trigger_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sug_created ON agent_suggestions(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sug_outcome ON agent_suggestions(outcome)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sched_org ON agent_schedules(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sched_enabled ON agent_schedules(enabled)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sched_run_sched ON agent_schedule_runs(schedule_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_sched_run_status ON agent_schedule_runs(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_files_conv ON agent_files(conversation_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_files_org ON agent_files(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_briefings_org ON agent_briefings(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_briefings_generated ON agent_briefings(generated_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_briefings_status ON agent_briefings(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_org ON agent_tasks(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_source ON agent_tasks(source)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON agent_tasks(parent_task_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_equipment ON agent_tasks(equipment_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_vessel ON agent_tasks(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_findings_org ON agent_findings(org_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_findings_type ON agent_findings(finding_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_findings_severity ON agent_findings(severity)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_findings_status ON agent_findings(status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_findings_task ON agent_findings(task_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_agent_findings_equipment ON agent_findings(equipment_id)`,
  ];
}
