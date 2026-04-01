ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS auto_trigger_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS auto_trigger_threshold REAL NOT NULL DEFAULT 0.85;
