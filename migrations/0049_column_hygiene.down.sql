-- 0049 down — revert timestamps, numeric conversions, and re-add the
-- (always-null) password reset columns.

ALTER TABLE import_manifest
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE pdm_baseline
  DROP COLUMN IF EXISTS created_at;
ALTER TABLE pdm_alerts
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE real_time_predictions
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE model_metrics
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE anomaly_detections
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
ALTER TABLE equipment_dependency_layouts
  DROP COLUMN IF EXISTS created_at;

DO $num_down$
DECLARE
  spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('ml_models', 'accuracy', 'numeric(5,2)'),
      ('ml_models', 'precision', 'numeric(5,2)'),
      ('ml_models', 'recall', 'numeric(5,2)'),
      ('ml_models', 'f1_score', 'numeric(5,2)'),
      ('model_versions', 'accuracy', 'numeric(5,2)'),
      ('model_versions', 'precision', 'numeric(5,2)'),
      ('model_versions', 'recall', 'numeric(5,2)'),
      ('model_versions', 'f1_score', 'numeric(5,2)'),
      ('maintenance_templates', 'interval_hours', 'numeric')
    ) AS t(tbl, col, typ)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = spec.tbl AND column_name = spec.col
         AND data_type = 'real'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE %s USING %I::%s',
        spec.tbl, spec.col, spec.typ, spec.col, spec.typ
      );
    END IF;
  END LOOP;
END
$num_down$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token text,
  ADD COLUMN IF NOT EXISTS password_reset_expires timestamp;
