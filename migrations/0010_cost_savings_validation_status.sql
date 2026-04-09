-- Migration: Add validation status columns to cost_savings table
-- Supports savings claim integrity: validation lifecycle, dispute tracking, auto-void

ALTER TABLE cost_savings ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'valid' NOT NULL;
ALTER TABLE cost_savings ADD COLUMN IF NOT EXISTS validation_changed_by TEXT;
ALTER TABLE cost_savings ADD COLUMN IF NOT EXISTS validation_changed_at TIMESTAMP;
ALTER TABLE cost_savings ADD COLUMN IF NOT EXISTS validation_reason TEXT;

DO $$ BEGIN
  ALTER TABLE cost_savings ADD CONSTRAINT chk_validation_status
    CHECK (validation_status IN ('valid', 'disputed', 'voided'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
