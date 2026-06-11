-- 0044 down — recreate the dropped tables (DDL as of the drop; data is
-- not restorable, but every table was verified write-less so nothing of
-- value existed in them).

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
CREATE INDEX IF NOT EXISTS idx_telemetry_agg_equipment_time
  ON telemetry_aggregates (equipment_id, window_start);
CREATE INDEX IF NOT EXISTS idx_telemetry_agg_org_time
  ON telemetry_aggregates (org_id, window_start);

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
