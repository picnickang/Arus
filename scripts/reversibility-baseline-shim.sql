-- ============================================================================
-- Reversibility-harness baseline shim — NOT a production migration.
--
-- Applied ONLY by scripts/check-migrations-reversible.sh, immediately after
-- `drizzle-kit push` seeds the current schema into the scratch database and
-- BEFORE the numbered migrations replay.
--
-- WHY THIS EXISTS
--   The numbered migrations/NNNN_*.sql are additive deltas authored against an
--   *evolving* db:push baseline. A handful of mid-chain deltas (0018 RLS, 0022
--   unique indexes, 0041 numeric conversions, 0046 org-FK backfill) touch
--   tables that were later DROPPED from the live schema by 0044/0050 and so are
--   no longer created by `drizzle-kit push`:
--       inventory_parts, telemetry_aggregates, telemetry_rollups, ml_models_legacy
--   Without these tables present, the from-scratch replay dies before it can
--   reach the drops. This shim recreates them so the chain replays end-to-end;
--   0044/0050 then drop them again, so they are absent from the final schema
--   (and from both compared snapshots).
--
--   ml_audit_log is intentionally NOT recreated: it was never defined anywhere
--   in the repo, and 0050 drops it with IF EXISTS (a no-op when absent).
--
-- The DDL below is copied verbatim from the matching 0044/0050 *.down.sql
-- recreate blocks (the canonical "DDL as of the drop"). Keep them in sync.
-- ============================================================================

CREATE TABLE IF NOT EXISTS telemetry_rollups (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id varchar NOT NULL REFERENCES organizations(id),
  equipment_id text NOT NULL,
  sensor_type text NOT NULL,
  bucket timestamp NOT NULL,
  bucket_size text NOT NULL,
  avg_value real,
  min_value real,
  max_value real,
  sample_count integer NOT NULL,
  unit text
);

CREATE TABLE IF NOT EXISTS telemetry_aggregates (
  id serial PRIMARY KEY,
  org_id varchar NOT NULL DEFAULT 'default-org-id',
  equipment_id varchar NOT NULL,
  sensor_type varchar NOT NULL,
  time_window varchar NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  avg_value real,
  min_value real,
  max_value real,
  std_dev real,
  sample_count integer,
  anomaly_score real,
  quality_score real,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_parts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id varchar NOT NULL REFERENCES organizations(id),
  part_number text NOT NULL,
  description text NOT NULL,
  current_stock integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL,
  max_stock_level integer NOT NULL,
  lead_time_days integer NOT NULL,
  unit_cost real,
  supplier text,
  last_usage_30d integer DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

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
