-- Rollback for 0031_crew_role_defaults.sql
ALTER TABLE crew DROP COLUMN IF EXISTS watch_keeping;
ALTER TABLE crew DROP COLUMN IF EXISTS department;

ALTER TABLE crew_roles DROP COLUMN IF EXISTS default_role_id;
ALTER TABLE crew_roles DROP COLUMN IF EXISTS default_watch_keeping;
ALTER TABLE crew_roles DROP COLUMN IF EXISTS default_max_hours;
ALTER TABLE crew_roles DROP COLUMN IF EXISTS default_min_rest_hours;
ALTER TABLE crew_roles DROP COLUMN IF EXISTS default_department;
