-- Reverse migration for 0012_add_conflict_resolution.sql
-- Drops the conflict-resolution version tracking, sync_conflicts table,
-- and sync_journal field-level columns. Idempotent.
--
-- OWNERSHIP NOTE: 0012 re-adds `version`/`last_modified_by` to `equipment`
-- with IF NOT EXISTS, but those columns are owned by 0001 (which created
-- them first). This down migration therefore only drops the column 0012
-- exclusively introduced on `equipment` (`last_modified_device`); the
-- shared `version`/`last_modified_by` are reversed by 0001.down.sql.

-- Field-level sync_journal columns and index
DROP INDEX IF EXISTS idx_sync_journal_field_changes;
ALTER TABLE sync_journal DROP COLUMN IF EXISTS version_after;
ALTER TABLE sync_journal DROP COLUMN IF EXISTS version_before;
ALTER TABLE sync_journal DROP COLUMN IF EXISTS device_id;
ALTER TABLE sync_journal DROP COLUMN IF EXISTS new_value;
ALTER TABLE sync_journal DROP COLUMN IF EXISTS old_value;
ALTER TABLE sync_journal DROP COLUMN IF EXISTS field_name;

-- sync_conflicts table and its indexes
DROP INDEX IF EXISTS idx_sync_conflicts_safety;
DROP INDEX IF EXISTS idx_sync_conflicts_unresolved;
DROP TABLE IF EXISTS sync_conflicts;

-- Version tracking columns. For equipment, only last_modified_device is
-- owned here (see ownership note above).
ALTER TABLE equipment DROP COLUMN IF EXISTS last_modified_device;

ALTER TABLE dtc_faults DROP COLUMN IF EXISTS last_modified_device;
ALTER TABLE dtc_faults DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE dtc_faults DROP COLUMN IF EXISTS version;

ALTER TABLE crew_assignment DROP COLUMN IF EXISTS last_modified_device;
ALTER TABLE crew_assignment DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE crew_assignment DROP COLUMN IF EXISTS version;

ALTER TABLE work_orders DROP COLUMN IF EXISTS last_modified_device;
ALTER TABLE work_orders DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE work_orders DROP COLUMN IF EXISTS version;

ALTER TABLE operating_parameters DROP COLUMN IF EXISTS last_modified_device;
ALTER TABLE operating_parameters DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE operating_parameters DROP COLUMN IF EXISTS version;

ALTER TABLE alert_configurations DROP COLUMN IF EXISTS last_modified_device;
ALTER TABLE alert_configurations DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE alert_configurations DROP COLUMN IF EXISTS version;

ALTER TABLE sensor_configurations DROP COLUMN IF EXISTS last_modified_device;
ALTER TABLE sensor_configurations DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE sensor_configurations DROP COLUMN IF EXISTS version;
