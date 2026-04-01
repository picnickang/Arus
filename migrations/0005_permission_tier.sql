ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS permission_tier TEXT NOT NULL DEFAULT 'strict';
