-- Reverse migration for 0006_auto_trigger_config.sql
-- Drops the agent auto-trigger configuration columns. Idempotent.

ALTER TABLE agent_config DROP COLUMN IF EXISTS auto_trigger_threshold;
ALTER TABLE agent_config DROP COLUMN IF EXISTS auto_trigger_enabled;
