-- 0049 — Column hygiene: timestamps, string-mode numerics, dead columns
--
-- Three small, unrelated-but-mechanical cleanups bundled per the wave-3
-- remediation plan:
--
-- 1. TIMESTAMPS — seven tables had no created_at/updated_at (or only
--    one of them): import_manifest, pdm_baseline (created only),
--    pdm_alerts, real_time_predictions, model_metrics,
--    anomaly_detections, equipment_dependency_layouts (created only).
--    Added with DEFAULT now(): PG11+ fast-path — metadata-only, no
--    table rewrite; pre-existing rows backfill to the migration time,
--    which is honest ("we don't know when this row was created, this
--    is when tracking began"). NOTE updated_at is app-maintained on
--    UPDATE (no trigger), same as every other table here.
--
-- 2. NUMERIC POLICY (0041) — scores and hours are statistics, not
--    money, and were stored as string-mode numeric:
--      ml_models.accuracy/precision/recall/f1_score   numeric(5,2) -> real
--      model_versions.accuracy/precision/recall/f1_score same
--      maintenance_templates.interval_hours           numeric -> real
--    vessels.day_rate_sgd/downtime_days/operation_days stay numeric in
--    the DB (money/quantities) — only the Drizzle mode flips to
--    "number", no DDL here. entity_offsets.seq numeric(20,0) stays
--    string-mode deliberately (exceeds MAX_SAFE_INTEGER).
--
-- 3. DEAD COLUMNS — users.password_reset_token/_expires: no password
--    reset flow ever shipped (zero readers/writers anywhere). Dropped;
--    a future reset flow should store only a token hash.
--
-- Idempotent throughout (IF NOT EXISTS / IF EXISTS / type guards).

-- 1. Timestamps ------------------------------------------------------------
ALTER TABLE import_manifest
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE pdm_baseline
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
ALTER TABLE pdm_alerts
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE real_time_predictions
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE model_metrics
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE anomaly_detections
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE equipment_dependency_layouts
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- 2. Numeric -> real (only when still numeric, so re-runs and
--    push-bootstrapped databases are no-ops) -------------------------------
DO $num$
DECLARE
  spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('ml_models', 'accuracy'), ('ml_models', 'precision'),
      ('ml_models', 'recall'), ('ml_models', 'f1_score'),
      ('model_versions', 'accuracy'), ('model_versions', 'precision'),
      ('model_versions', 'recall'), ('model_versions', 'f1_score'),
      ('maintenance_templates', 'interval_hours')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = spec.tbl AND column_name = spec.col
         AND data_type = 'numeric'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE real USING %I::real',
        spec.tbl, spec.col, spec.col
      );
    END IF;
  END LOOP;
END
$num$;

-- 3. Dead columns ----------------------------------------------------------
ALTER TABLE users
  DROP COLUMN IF EXISTS password_reset_token,
  DROP COLUMN IF EXISTS password_reset_expires;
