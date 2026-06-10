-- 0040 — Referential integrity for ML prediction tables
--
-- anomaly_detections and failure_predictions carried unenforced
-- org_id/equipment_id columns (no FK anywhere), and their model_id FK
-- still pointed at ml_models_legacy while every active writer either
-- leaves model_id NULL (server/ml-analytics/database.ts) or records
-- model_version_id -> model_versions -> ml_models (prediction engine).
--
-- This migration:
--   1. Deletes orphaned rows (dead org/equipment refs) with NOTICE counts
--      — these are derived analytics rows, reproducible from telemetry.
--   2. NULLs model_id values that don't exist in ml_models. Because the
--      FK retargets from ml_models_legacy to ml_models, surviving legacy
--      ids are EXPECTED to be nulled in bulk here, not an edge case.
--   3. Drops the legacy FK (located by confrelid, never by name) and adds
--      enforced FKs:  org_id -> organizations (NO ACTION),
--      equipment_id -> equipment ON DELETE CASCADE (generated child
--      records per the 0023 cascade policy), model_id -> ml_models
--      ON DELETE SET NULL. Constraint names follow drizzle-kit's pattern
--      so push-bootstrapped and migrated databases converge.
--   4. Adds the missing org-time indexes for tenant-scoped time scans.
--
-- ADD CONSTRAINT ... NOT VALID + VALIDATE is used for failure
-- attribution (a validation failure names the exact constraint). The
-- runner wraps the file in one transaction, so this does not shorten
-- lock windows; on very large installations the VALIDATE statements can
-- be split into a maintenance window instead.

DO $$
DECLARE
  n_org INTEGER;
  n_equipment INTEGER;
  n_model INTEGER;
  con_name TEXT;
BEGIN
  -- ── anomaly_detections ────────────────────────────────────────────────
  DELETE FROM anomaly_detections ad
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ad.org_id);
  GET DIAGNOSTICS n_org = ROW_COUNT;

  DELETE FROM anomaly_detections ad
  WHERE NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = ad.equipment_id);
  GET DIAGNOSTICS n_equipment = ROW_COUNT;

  UPDATE anomaly_detections ad
  SET model_id = NULL
  WHERE ad.model_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ml_models m WHERE m.id = ad.model_id);
  GET DIAGNOSTICS n_model = ROW_COUNT;

  RAISE NOTICE '0040 anomaly_detections: % dead-org rows deleted, % dead-equipment rows deleted, % legacy model_id values nulled',
    n_org, n_equipment, n_model;

  -- Drop the legacy model_id FK -> ml_models_legacy (name varies by era).
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class r  ON r.oid = c.conrelid
  JOIN pg_class rr ON rr.oid = c.confrelid
  WHERE c.contype = 'f'
    AND r.relname = 'anomaly_detections'
    AND rr.relname = 'ml_models_legacy';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE anomaly_detections DROP CONSTRAINT %I', con_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anomaly_detections_org_id_organizations_id_fk'
  ) THEN
    ALTER TABLE anomaly_detections
      ADD CONSTRAINT anomaly_detections_org_id_organizations_id_fk
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
    ALTER TABLE anomaly_detections
      VALIDATE CONSTRAINT anomaly_detections_org_id_organizations_id_fk;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anomaly_detections_equipment_id_equipment_id_fk'
  ) THEN
    ALTER TABLE anomaly_detections
      ADD CONSTRAINT anomaly_detections_equipment_id_equipment_id_fk
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE anomaly_detections
      VALIDATE CONSTRAINT anomaly_detections_equipment_id_equipment_id_fk;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anomaly_detections_model_id_ml_models_id_fk'
  ) THEN
    ALTER TABLE anomaly_detections
      ADD CONSTRAINT anomaly_detections_model_id_ml_models_id_fk
      FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE SET NULL NOT VALID;
    ALTER TABLE anomaly_detections
      VALIDATE CONSTRAINT anomaly_detections_model_id_ml_models_id_fk;
  END IF;

  -- ── failure_predictions ───────────────────────────────────────────────
  DELETE FROM failure_predictions fp
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = fp.org_id);
  GET DIAGNOSTICS n_org = ROW_COUNT;

  DELETE FROM failure_predictions fp
  WHERE NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = fp.equipment_id);
  GET DIAGNOSTICS n_equipment = ROW_COUNT;

  UPDATE failure_predictions fp
  SET model_id = NULL
  WHERE fp.model_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ml_models m WHERE m.id = fp.model_id);
  GET DIAGNOSTICS n_model = ROW_COUNT;

  RAISE NOTICE '0040 failure_predictions: % dead-org rows deleted, % dead-equipment rows deleted, % legacy model_id values nulled',
    n_org, n_equipment, n_model;

  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class r  ON r.oid = c.conrelid
  JOIN pg_class rr ON rr.oid = c.confrelid
  WHERE c.contype = 'f'
    AND r.relname = 'failure_predictions'
    AND rr.relname = 'ml_models_legacy';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE failure_predictions DROP CONSTRAINT %I', con_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'failure_predictions_org_id_organizations_id_fk'
  ) THEN
    ALTER TABLE failure_predictions
      ADD CONSTRAINT failure_predictions_org_id_organizations_id_fk
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
    ALTER TABLE failure_predictions
      VALIDATE CONSTRAINT failure_predictions_org_id_organizations_id_fk;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'failure_predictions_equipment_id_equipment_id_fk'
  ) THEN
    ALTER TABLE failure_predictions
      ADD CONSTRAINT failure_predictions_equipment_id_equipment_id_fk
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE failure_predictions
      VALIDATE CONSTRAINT failure_predictions_equipment_id_equipment_id_fk;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'failure_predictions_model_id_ml_models_id_fk'
  ) THEN
    ALTER TABLE failure_predictions
      ADD CONSTRAINT failure_predictions_model_id_ml_models_id_fk
      FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE SET NULL NOT VALID;
    ALTER TABLE failure_predictions
      VALIDATE CONSTRAINT failure_predictions_model_id_ml_models_id_fk;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_anomaly_org_time
  ON anomaly_detections (org_id, detection_timestamp);

CREATE INDEX IF NOT EXISTS idx_failure_org_time
  ON failure_predictions (org_id, prediction_timestamp);
