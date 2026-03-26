-- Telemetry Table Partitioning Migration
-- Hardening Item: Telemetry aggregation table has no partitioning strategy.

-- If using TimescaleDB (check with: SELECT * FROM pg_extension WHERE extname = 'timescaledb'):
--   Run the TimescaleDB section below.
-- If using standard PostgreSQL:
--   Run the native partitioning section.

-- ============================================================================
-- Option A: TimescaleDB (preferred if available)
-- ============================================================================

-- Convert telemetry_aggregated to a hypertable
-- SELECT create_hypertable('telemetry_aggregated', 'bucket_start',
--   chunk_time_interval => INTERVAL '1 day',
--   if_not_exists => TRUE,
--   migrate_data => TRUE
-- );

-- Add compression policy (compress chunks older than 7 days)
-- ALTER TABLE telemetry_aggregated SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'org_id, equipment_id, sensor_type, bucket_size',
--   timescaledb.compress_orderby = 'bucket_start DESC'
-- );
-- SELECT add_compression_policy('telemetry_aggregated', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy (drop data older than 365 days for daily, 90 for hourly)
-- SELECT add_retention_policy('telemetry_aggregated', INTERVAL '365 days', if_not_exists => TRUE);

-- ============================================================================
-- Option B: Standard PostgreSQL Native Partitioning
-- ============================================================================

-- Note: This requires recreating the table. Back up data first.
-- The approach: partition by bucket_size, then sub-partition by month.

-- Step 1: Rename existing table
-- ALTER TABLE IF EXISTS telemetry_aggregated RENAME TO telemetry_aggregated_old;

-- Step 2: Create partitioned table
-- CREATE TABLE IF NOT EXISTS telemetry_aggregated (
--   id              SERIAL,
--   org_id          TEXT NOT NULL,
--   equipment_id    TEXT NOT NULL,
--   sensor_type     TEXT NOT NULL,
--   bucket_start    TIMESTAMPTZ NOT NULL,
--   bucket_size     TEXT NOT NULL CHECK (bucket_size IN ('1_minute', '1_hour', '1_day')),
--   count           INTEGER NOT NULL DEFAULT 0,
--   min_value       DOUBLE PRECISION,
--   max_value       DOUBLE PRECISION,
--   avg_value       DOUBLE PRECISION,
--   stddev_value    DOUBLE PRECISION,
--   p50_value       DOUBLE PRECISION,
--   p95_value       DOUBLE PRECISION,
--   p99_value       DOUBLE PRECISION,
--   first_value     DOUBLE PRECISION,
--   last_value      DOUBLE PRECISION,
--   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- ) PARTITION BY LIST (bucket_size);

-- Step 3: Create partitions for each bucket size
-- CREATE TABLE IF NOT EXISTS telemetry_agg_1min
--   PARTITION OF telemetry_aggregated FOR VALUES IN ('1_minute');
-- CREATE TABLE IF NOT EXISTS telemetry_agg_1hour
--   PARTITION OF telemetry_aggregated FOR VALUES IN ('1_hour');
-- CREATE TABLE IF NOT EXISTS telemetry_agg_1day
--   PARTITION OF telemetry_aggregated FOR VALUES IN ('1_day');

-- Step 4: Add indexes on each partition
-- CREATE INDEX IF NOT EXISTS idx_agg_1min_lookup
--   ON telemetry_agg_1min (org_id, equipment_id, sensor_type, bucket_start);
-- CREATE INDEX IF NOT EXISTS idx_agg_1hour_lookup
--   ON telemetry_agg_1hour (org_id, equipment_id, sensor_type, bucket_start);
-- CREATE INDEX IF NOT EXISTS idx_agg_1day_lookup
--   ON telemetry_agg_1day (org_id, equipment_id, sensor_type, bucket_start);

-- Step 5: Add unique constraint per partition
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_1min_unique
--   ON telemetry_agg_1min (org_id, equipment_id, sensor_type, bucket_start);
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_1hour_unique
--   ON telemetry_agg_1hour (org_id, equipment_id, sensor_type, bucket_start);
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_1day_unique
--   ON telemetry_agg_1day (org_id, equipment_id, sensor_type, bucket_start);

-- Step 6: Migrate data from old table
-- INSERT INTO telemetry_aggregated SELECT * FROM telemetry_aggregated_old ON CONFLICT DO NOTHING;

-- Step 7: Drop old table (verify data migrated first!)
-- DROP TABLE telemetry_aggregated_old;
