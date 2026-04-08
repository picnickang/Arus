-- Add outcome tracking columns to agent_suggestions table
ALTER TABLE agent_suggestions ADD COLUMN IF NOT EXISTS outcome varchar(50);
ALTER TABLE agent_suggestions ADD COLUMN IF NOT EXISTS outcome_reason text;
ALTER TABLE agent_suggestions ADD COLUMN IF NOT EXISTS outcome_at timestamp;
ALTER TABLE agent_suggestions ADD COLUMN IF NOT EXISTS outcome_by varchar(255);
ALTER TABLE agent_suggestions ADD COLUMN IF NOT EXISTS linked_prediction_id varchar(255);

-- Index for effectiveness queries (resolved suggestions by outcome timestamp)
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_outcome_at
  ON agent_suggestions (org_id, status, outcome_at)
  WHERE status IN ('acted', 'dismissed', 'deferred');
