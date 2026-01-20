-- Performance Indexes Migration
-- Option A (Gold Standard): Indexes managed via migrations, not boot-time DDL
-- 
-- These indexes optimize the most common query patterns in ARUS:
-- 1. Equipment lookups by vessel
-- 2. Maintenance history queries
-- 3. Telemetry time-series queries
-- 4. ML model status queries
-- 5. Alert history queries

-- Equipment: Lookup by vessel with created_at ordering
CREATE INDEX IF NOT EXISTS idx_equipment_vessel_created 
  ON equipment(vessel_id, created_at DESC);

-- Maintenance records: Equipment history with date ordering
CREATE INDEX IF NOT EXISTS idx_maintenance_records_equipment_date 
  ON maintenance_records(equipment_id, actual_start_time DESC);

-- Maintenance records: Org-scoped queries
CREATE INDEX IF NOT EXISTS idx_maintenance_records_org_id 
  ON maintenance_records(org_id);

-- Raw telemetry: Time-series queries by source
CREATE INDEX IF NOT EXISTS idx_raw_telemetry_equipment_ts 
  ON raw_telemetry(src, ts DESC);

-- ML models: Status lookups by org
CREATE INDEX IF NOT EXISTS idx_ml_models_org_status 
  ON ml_models(org_id, status);

-- PdM alerts: Alert history by asset
CREATE INDEX IF NOT EXISTS idx_pdm_alerts_asset_time 
  ON pdm_alerts(asset_id, at DESC);

-- PdM alerts: Fleet-wide alert views by vessel
CREATE INDEX IF NOT EXISTS idx_pdm_alerts_vessel 
  ON pdm_alerts(vessel_name, at DESC);
