-- Reverse migration for 0011_cost_savings_validation_status.sql
-- Drops the cost_savings validation-status columns and check constraint. Idempotent.

ALTER TABLE cost_savings DROP CONSTRAINT IF EXISTS chk_validation_status;
ALTER TABLE cost_savings DROP COLUMN IF EXISTS validation_reason;
ALTER TABLE cost_savings DROP COLUMN IF EXISTS validation_changed_at;
ALTER TABLE cost_savings DROP COLUMN IF EXISTS validation_changed_by;
ALTER TABLE cost_savings DROP COLUMN IF EXISTS validation_status;
