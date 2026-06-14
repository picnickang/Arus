-- 0050 down — recreate the ml_models_legacy shell (DDL as of the drop;
-- data is not restorable, but the table was verified write-less).
--
-- ml_audit_log is NOT recreated: it was never defined anywhere in the
-- repo (no schema entry, no migration, no git history), so there is no
-- DDL to restore it from.

CREATE TABLE IF NOT EXISTS ml_models_legacy (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id varchar NOT NULL REFERENCES organizations(id),
  name varchar NOT NULL,
  version varchar NOT NULL,
  model_type varchar NOT NULL,
  target_equipment_type varchar,
  training_data_features jsonb,
  hyperparameters jsonb,
  performance jsonb,
  model_artifact_path varchar,
  status varchar DEFAULT 'training',
  deployed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ml_models_legacy_name_version
  ON ml_models_legacy (name, version);
CREATE INDEX IF NOT EXISTS idx_ml_models_legacy_org
  ON ml_models_legacy (org_id);
