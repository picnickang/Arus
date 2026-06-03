-- 0027 crew profile fields (Crew Profiles & Forms — Figma template)
-- Adds the profile/intake fields the crew profile + add-crew template needs
-- that were not yet present on the crew row:
--   crew_code         — human-readable crew code (e.g. "CRW-0001")
--   status            — explicit employment status (active|on_leave|standby|onboard)
--   employment_type   — permanent|contract|temporary|rotational
--   reports_to_id     — supervisor (another crew member) this person reports to
--   rotation_on_days  — rotation pattern: days on
--   rotation_off_days — rotation pattern: days off
-- All nullable (status defaults to 'active') so existing rows are unaffected.
-- Idempotent (IF NOT EXISTS) so a re-run is a no-op.
ALTER TABLE crew ADD COLUMN IF NOT EXISTS crew_code text;
ALTER TABLE crew ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE crew ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE crew ADD COLUMN IF NOT EXISTS reports_to_id varchar
  REFERENCES crew(id) ON DELETE SET NULL;
ALTER TABLE crew ADD COLUMN IF NOT EXISTS rotation_on_days integer;
ALTER TABLE crew ADD COLUMN IF NOT EXISTS rotation_off_days integer;

CREATE INDEX IF NOT EXISTS idx_crew_reports_to ON crew (reports_to_id);
