-- Reverse migration for 0003_context_compaction.sql
-- Drops the agent context-compaction columns. Idempotent.

ALTER TABLE agent_config DROP COLUMN IF EXISTS tool_output_char_limit;
ALTER TABLE agent_config DROP COLUMN IF EXISTS compaction_threshold;
ALTER TABLE agent_config DROP COLUMN IF EXISTS context_compaction;
ALTER TABLE agent_conversations DROP COLUMN IF EXISTS summarized_up_to;
ALTER TABLE agent_conversations DROP COLUMN IF EXISTS context_summary;
