const ROOT_MIGRATIONS_DIRNAME = "migrations";
const SERVER_MIGRATIONS_DIRNAME = "server/migrations";

// Stable 64-bit advisory-lock key. MUST match `scripts/run-sql-migrations.mjs`
// so a concurrent deploy and post-merge serialize against the same key.
const ADVISORY_LOCK_KEY = 779231474;

const ROOT_TRACKER_DDL = `
  CREATE TABLE IF NOT EXISTS arus_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const SERVER_TRACKER_DDL = `
  CREATE TABLE IF NOT EXISTS arus_sql_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

// Migrations that DROP the dead tables. When either is still pending we are
// replaying the chain from a baseline that no longer contains those tables, so
// the mid-chain migrations that touch them (0018/0022/0040/0041/0045) would
// fail with "relation does not exist" before the chain reaches the drop.
const DEAD_TABLE_DROP_MIGRATIONS = ["0044_drop_dead_tables.sql", "0050_drop_dead_tables_wave2.sql"];

// Dead-table shim. `drizzle-kit push` no longer creates these four tables
// (0044/0050 dropped them from the live schema), but mid-chain migrations still
// reference them. Recreating them lets a from-baseline replay run end-to-end;
// 0044/0050 then drop them again, so they are absent from the final schema.
// Kept in sync with scripts/reversibility-baseline-shim.sql (the reversibility
// harness applies the same DDL). Embedded (not file-read) so the production
// boot-migration path works regardless of how the image is bundled.
const DEAD_TABLE_SHIM_DDL = `
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
`;

export {
  ROOT_MIGRATIONS_DIRNAME,
  SERVER_MIGRATIONS_DIRNAME,
  ADVISORY_LOCK_KEY,
  ROOT_TRACKER_DDL,
  SERVER_TRACKER_DDL,
  DEAD_TABLE_DROP_MIGRATIONS,
  DEAD_TABLE_SHIM_DDL,
};
