-- Push A1 — Label pipeline for weekly model retraining.
-- See shared/schema/ml-analytics-advanced.ts (predictionOutcomes).

CREATE TABLE IF NOT EXISTS prediction_outcomes (
  id SERIAL PRIMARY KEY,
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prediction_id INTEGER NOT NULL,
  prediction_type VARCHAR NOT NULL,
  equipment_id VARCHAR NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  model_id VARCHAR REFERENCES ml_models(id) ON DELETE SET NULL,
  model_version VARCHAR,
  feature_snapshot_id VARCHAR,
  predicted_failure_probability REAL NOT NULL,
  predicted_rul INTEGER,
  predicted_failure_date TIMESTAMPTZ,
  actual_failure_mode VARCHAR,
  actual_failure_date TIMESTAMPTZ,
  actual_outcome_label VARCHAR,
  rul_error_days INTEGER,
  absolute_error REAL,
  outcome_source VARCHAR NOT NULL,
  source_record_id VARCHAR,
  use_for_retraining BOOLEAN NOT NULL DEFAULT TRUE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pred_outcomes_org_equip
  ON prediction_outcomes (org_id, equipment_id);

CREATE INDEX IF NOT EXISTS idx_pred_outcomes_model
  ON prediction_outcomes (model_id);

CREATE INDEX IF NOT EXISTS idx_pred_outcomes_retrain
  ON prediction_outcomes (use_for_retraining, observed_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_pred_outcomes_pred_source'
  ) THEN
    ALTER TABLE prediction_outcomes
      ADD CONSTRAINT uq_pred_outcomes_pred_source
      UNIQUE (prediction_id, prediction_type, outcome_source);
  END IF;
END $$;
