-- Task #348: per crew-role defaults + suggested app-access link.
-- Adds default fields to the crew_roles catalog (from #347) and the matching
-- columns on the crew table that those defaults pre-fill. All additive and
-- nullable, so existing rows are untouched (existing crew keep their values
-- until next edited).

ALTER TABLE crew_roles ADD COLUMN IF NOT EXISTS default_department text;
ALTER TABLE crew_roles ADD COLUMN IF NOT EXISTS default_min_rest_hours real;
ALTER TABLE crew_roles ADD COLUMN IF NOT EXISTS default_max_hours real;
ALTER TABLE crew_roles ADD COLUMN IF NOT EXISTS default_watch_keeping text;
ALTER TABLE crew_roles ADD COLUMN IF NOT EXISTS default_role_id varchar
  REFERENCES roles(id) ON DELETE SET NULL;

ALTER TABLE crew ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE crew ADD COLUMN IF NOT EXISTS watch_keeping text;
