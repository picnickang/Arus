-- 0040 down — remove ML prediction FKs and org-time indexes
--
-- Best-effort reverse: orphan rows deleted by the up migration are NOT
-- restorable, and model_id values nulled there stay NULL. The legacy
-- model_id -> ml_models_legacy FKs are restored as NOT VALID only (the
-- data may no longer validate against the legacy table).

DROP INDEX IF EXISTS idx_anomaly_org_time;
DROP INDEX IF EXISTS idx_failure_org_time;

ALTER TABLE anomaly_detections
  DROP CONSTRAINT IF EXISTS anomaly_detections_org_id_organizations_id_fk;
ALTER TABLE anomaly_detections
  DROP CONSTRAINT IF EXISTS anomaly_detections_equipment_id_equipment_id_fk;
ALTER TABLE anomaly_detections
  DROP CONSTRAINT IF EXISTS anomaly_detections_model_id_ml_models_id_fk;

ALTER TABLE failure_predictions
  DROP CONSTRAINT IF EXISTS failure_predictions_org_id_organizations_id_fk;
ALTER TABLE failure_predictions
  DROP CONSTRAINT IF EXISTS failure_predictions_equipment_id_equipment_id_fk;
ALTER TABLE failure_predictions
  DROP CONSTRAINT IF EXISTS failure_predictions_model_id_ml_models_id_fk;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ml_models_legacy') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'anomaly_detections_model_id_ml_models_legacy_id_fk'
    ) THEN
      ALTER TABLE anomaly_detections
        ADD CONSTRAINT anomaly_detections_model_id_ml_models_legacy_id_fk
        FOREIGN KEY (model_id) REFERENCES ml_models_legacy(id) NOT VALID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'failure_predictions_model_id_ml_models_legacy_id_fk'
    ) THEN
      ALTER TABLE failure_predictions
        ADD CONSTRAINT failure_predictions_model_id_ml_models_legacy_id_fk
        FOREIGN KEY (model_id) REFERENCES ml_models_legacy(id) NOT VALID;
    END IF;
  END IF;
END $$;
