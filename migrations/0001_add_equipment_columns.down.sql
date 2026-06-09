-- Reverse migration for 0001_add_equipment_columns.sql
-- Drops the equipment columns added for schema sync. Idempotent.
-- NOTE: `version` and `last_modified_by` are owned by THIS migration;
-- 0012 only re-adds them with IF NOT EXISTS, so 0012.down deliberately
-- leaves them alone and they are dropped here.

ALTER TABLE equipment DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE equipment DROP COLUMN IF EXISTS version;
ALTER TABLE equipment DROP COLUMN IF EXISTS salvage_value;
ALTER TABLE equipment DROP COLUMN IF EXISTS depreciation_rate;
ALTER TABLE equipment DROP COLUMN IF EXISTS depreciation_method;
ALTER TABLE equipment DROP COLUMN IF EXISTS service_life_years;
ALTER TABLE equipment DROP COLUMN IF EXISTS service_life_hours;
ALTER TABLE equipment DROP COLUMN IF EXISTS purchase_currency;
ALTER TABLE equipment DROP COLUMN IF EXISTS purchase_date;
ALTER TABLE equipment DROP COLUMN IF EXISTS purchase_value;
ALTER TABLE equipment DROP COLUMN IF EXISTS default_service_provider_id;
ALTER TABLE equipment DROP COLUMN IF EXISTS criticality_level;
ALTER TABLE equipment DROP COLUMN IF EXISTS component_type;
ALTER TABLE equipment DROP COLUMN IF EXISTS system_type;
ALTER TABLE equipment DROP COLUMN IF EXISTS plain_language_name;
ALTER TABLE equipment DROP COLUMN IF EXISTS decommission_event_id;
ALTER TABLE equipment DROP COLUMN IF EXISTS decommission_status;
ALTER TABLE equipment DROP COLUMN IF EXISTS reinstated_by;
ALTER TABLE equipment DROP COLUMN IF EXISTS reinstated_at;
ALTER TABLE equipment DROP COLUMN IF EXISTS decommissioned_by;
