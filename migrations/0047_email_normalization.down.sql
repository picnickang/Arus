-- 0047 down — restore the case-sensitive unique index from 0039.
-- Same abort posture: exact-case duplicates (possible only if rows were
-- inserted outside the app while 0047 was active, since lower() unique
-- is stricter than exact-case unique) abort with a report.

DO $email_down$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM users GROUP BY org_id, email HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      '0047 down: % exact-duplicate (org_id, email) group(s) — resolve before reverting', dup_count;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email ON users (org_id, email);
  DROP INDEX IF EXISTS uq_users_org_email_lower;
END
$email_down$;
