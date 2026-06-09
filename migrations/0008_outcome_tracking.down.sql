-- Reverse migration for 0008_outcome_tracking.sql
-- Drops the agent_suggestions outcome-tracking columns and index. Idempotent.

DROP INDEX IF EXISTS idx_agent_suggestions_outcome_at;
ALTER TABLE agent_suggestions DROP COLUMN IF EXISTS linked_prediction_id;
ALTER TABLE agent_suggestions DROP COLUMN IF EXISTS outcome_by;
ALTER TABLE agent_suggestions DROP COLUMN IF EXISTS outcome_at;
ALTER TABLE agent_suggestions DROP COLUMN IF EXISTS outcome_reason;
ALTER TABLE agent_suggestions DROP COLUMN IF EXISTS outcome;
