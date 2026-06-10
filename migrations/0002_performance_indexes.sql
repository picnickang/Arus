-- Performance Indexes Migration
-- Option A (Gold Standard): Indexes managed via migrations, not boot-time DDL
--
-- These indexes optimize the most common query patterns in ARUS:
-- 1. Equipment lookups by vessel
-- 2. Maintenance history queries
-- 3. Telemetry time-series queries
-- 4. ML model status queries
-- 5. Alert history queries
--
-- Guarded: each index is created only when its table and columns exist.
-- This migration predates later schema evolution (e.g. maintenance_records
-- no longer has actual_start_time), and a fresh database bootstrapped via
-- `db:push` gets the CURRENT schema — replaying the original unguarded DDL
-- there fails. The ledger (arus_migrations) is filename-only, so databases
-- that already applied the original version are unaffected by this guard.

DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('idx_equipment_vessel_created',            'equipment',           ARRAY['vessel_id', 'created_at'],         'equipment(vessel_id, created_at DESC)'),
      ('idx_maintenance_records_equipment_date',  'maintenance_records', ARRAY['equipment_id', 'actual_start_time'], 'maintenance_records(equipment_id, actual_start_time DESC)'),
      ('idx_maintenance_records_org_id',          'maintenance_records', ARRAY['org_id'],                          'maintenance_records(org_id)'),
      ('idx_raw_telemetry_equipment_ts',          'raw_telemetry',       ARRAY['src', 'ts'],                       'raw_telemetry(src, ts DESC)'),
      ('idx_ml_models_org_status',                'ml_models',           ARRAY['org_id', 'status'],                'ml_models(org_id, status)'),
      ('idx_pdm_alerts_asset_time',               'pdm_alerts',          ARRAY['asset_id', 'at'],                  'pdm_alerts(asset_id, at DESC)'),
      ('idx_pdm_alerts_vessel',                   'pdm_alerts',          ARRAY['vessel_name', 'at'],               'pdm_alerts(vessel_name, at DESC)')
    ) AS t(index_name, table_name, required_columns, index_def)
  LOOP
    IF to_regclass(spec.table_name) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM unnest(spec.required_columns) AS col
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = current_schema()
          AND c.table_name = spec.table_name
          AND c.column_name = col
      )
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s', spec.index_name, spec.index_def);
    ELSE
      RAISE NOTICE '0002: skipping % (table/columns absent in current schema)', spec.index_name;
    END IF;
  END LOOP;
END $$;
