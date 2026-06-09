-- Reverse migration for 0005_permission_tier.sql
-- Drops the agent permission-tier column. Idempotent.

ALTER TABLE agent_config DROP COLUMN IF EXISTS permission_tier;
