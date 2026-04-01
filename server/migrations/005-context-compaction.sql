ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS context_summary text;
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS summarized_up_to integer DEFAULT 0;
ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS context_compaction boolean NOT NULL DEFAULT true;
ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS compaction_threshold integer NOT NULL DEFAULT 30;
