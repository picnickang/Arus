-- 0050 — Drop dead tables, wave 2: ml_models_legacy, ml_audit_log
--
-- ml_models_legacy: superseded by ml_models + model_versions. 0040
--   retargeted the last live FKs (anomaly_detections.model_id,
--   failure_predictions.model_id) onto ml_models; since then the table
--   has had zero readers or writers (the TS definition, insert schema,
--   and registry entry are removed in this commit). A fail-closed guard
--   below aborts if any FK still references it at migration time —
--   if that fires, a hotfix re-added a dependency and the drop must be
--   re-evaluated, not forced.
--
-- ml_audit_log: flagged by the schema audit on deployed databases.
--   Nothing in the repo ever defined, created, read, or wrote it (no
--   schema entry, no migration, no git history) — it can only exist as
--   untracked manual DDL. Dropped with IF EXISTS; the down migration
--   cannot recreate it because no DDL source exists.
--
-- 0044 precedent: data is not restorable; both tables were verified
-- write-less so nothing of value exists in them.

DO $drop$
DECLARE
  fk_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'ml_models_legacy'
  ) THEN
    SELECT count(*) INTO fk_count
      FROM pg_constraint
     WHERE confrelid = 'ml_models_legacy'::regclass AND contype = 'f';
    IF fk_count > 0 THEN
      RAISE EXCEPTION
        '0050_drop_dead_tables_wave2: % foreign key(s) still reference ml_models_legacy — 0040 should have retargeted them; refusing to drop', fk_count;
    END IF;
    DROP TABLE ml_models_legacy;
  END IF;
END
$drop$;

DROP TABLE IF EXISTS ml_audit_log;
