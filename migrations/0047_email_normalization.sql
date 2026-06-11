-- ============================================================================
-- 0047  Case-insensitive email uniqueness + lookup
-- ============================================================================
-- 0039 added uq_users_org_email (org_id, email) case-SENSITIVELY to match
-- the then-current eq() lookups, flagging citext/lower() as a follow-up.
-- That left a real login-failure mode: SSO IdPs return claims with
-- arbitrary casing ("User@Example.com"), which missed "user@example.com"
-- on lookup and could even create a duplicate account differing only by
-- case. App code now lowercases on write and compares with lower() on
-- read (server/db/users/db-users.ts, sso/oidc.ts, sso/saml.ts,
-- crew-admin adapter); this migration makes the database agree:
--
--   * replace uq_users_org_email with uq_users_org_email_lower on
--     (org_id, lower(email)) — existing rows keep their display casing.
--   * citext was rejected: the type change ripples through the Drizzle
--     TS surface and has no SQLite analogue.
--
-- Duplicate handling follows 0039's abort posture: uniqueness cannot be
-- grandfathered, so case-fold collisions (same org, same lower(email))
-- ABORT with a report; resolve the listed accounts manually (merge or
-- re-address), then re-run db:migrate. The transaction wrapper rolls
-- back cleanly, and the old index stays in place until the new one is
-- created, so there is no enforcement gap on abort.

DO $email$
DECLARE
  dup_count  INTEGER;
  dup_report TEXT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM users GROUP BY org_id, lower(email) HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    SELECT string_agg(format('org_id=%s lower(email)=%s (%s rows)', org_id, lower_email, n), E'\n  ')
      INTO dup_report
    FROM (
      SELECT org_id, lower(email) AS lower_email, count(*) AS n
        FROM users
       GROUP BY org_id, lower(email)
      HAVING count(*) > 1
       ORDER BY count(*) DESC
       LIMIT 50
    ) dups;
    RAISE EXCEPTION E'0047_email_normalization: % case-fold duplicate group(s) in users — emails differing only by case within one org. Merge or re-address these accounts, then re-run db:migrate:\n  %',
      dup_count, dup_report;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email_lower
    ON users (org_id, lower(email));

  DROP INDEX IF EXISTS uq_users_org_email;
END
$email$;
