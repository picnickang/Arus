ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS deferred_tool_loading BOOLEAN NOT NULL DEFAULT true;
