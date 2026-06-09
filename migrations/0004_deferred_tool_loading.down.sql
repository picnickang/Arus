-- Reverse migration for 0004_deferred_tool_loading.sql
-- Drops the agent deferred-tool-loading flag. Idempotent.

ALTER TABLE agent_config DROP COLUMN IF EXISTS deferred_tool_loading;
