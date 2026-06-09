-- Reverse migration for 0002_performance_indexes.sql
-- Drops the performance indexes added for common query patterns. Idempotent.

DROP INDEX IF EXISTS idx_pdm_alerts_vessel;
DROP INDEX IF EXISTS idx_pdm_alerts_asset_time;
DROP INDEX IF EXISTS idx_ml_models_org_status;
DROP INDEX IF EXISTS idx_raw_telemetry_equipment_ts;
DROP INDEX IF EXISTS idx_maintenance_records_org_id;
DROP INDEX IF EXISTS idx_maintenance_records_equipment_date;
DROP INDEX IF EXISTS idx_equipment_vessel_created;
