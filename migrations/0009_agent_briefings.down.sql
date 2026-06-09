-- Reverse migration for 0009_agent_briefings.sql
-- Drops the agent_briefings table and its indexes. Idempotent.

DROP INDEX IF EXISTS "idx_agent_briefings_status";
DROP INDEX IF EXISTS "idx_agent_briefings_generated";
DROP INDEX IF EXISTS "idx_agent_briefings_org";
DROP TABLE IF EXISTS "agent_briefings";
