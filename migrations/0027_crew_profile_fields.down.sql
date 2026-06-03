-- Down: 0027 crew profile fields
DROP INDEX IF EXISTS idx_crew_reports_to;
ALTER TABLE crew DROP COLUMN IF EXISTS rotation_off_days;
ALTER TABLE crew DROP COLUMN IF EXISTS rotation_on_days;
ALTER TABLE crew DROP COLUMN IF EXISTS reports_to_id;
ALTER TABLE crew DROP COLUMN IF EXISTS employment_type;
ALTER TABLE crew DROP COLUMN IF EXISTS status;
ALTER TABLE crew DROP COLUMN IF EXISTS crew_code;
