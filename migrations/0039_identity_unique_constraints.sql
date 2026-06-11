-- 0039 — Identity natural-key unique indexes (tenant-scoped)
--
-- 1. users (org_id, email): previously there was NO unique constraint on
--    user emails anywhere (schema or migrations) — duplicate accounts were
--    prevented only by app code. Login lookup is org-scoped
--    (server/db/users/db-users.ts getUserByEmail(email, orgId?)) and a
--    multi-tenant deployment legitimately allows the same address across
--    orgs, so uniqueness is per (org_id, email). The index is
--    case-sensitive to match the existing eq() lookups; citext/lower()
--    normalization is a possible follow-up, not done here.
--
-- 2. work_orders wo_number: the schema declared wo_number UNIQUE globally
--    (drizzle-generated constraint), which wrongly prevents two orgs from
--    both holding WO-2026-0001-xxxx. Generation is already org-scoped
--    (server/db/workorders/db-core.ts generateWorkOrderNumber), so the
--    constraint is re-scoped to (org_id, wo_number). The old constraint is
--    located by (table, columns) via pg_constraint — push-created
--    databases may carry varying names (defensive lookup per 0023).
--
-- Duplicate pre-checks ABORT with a report rather than mutating data:
-- resolve the listed rows manually, then re-run db:migrate. The
-- transaction wrapper in server/scripts/migrate.ts rolls back cleanly.

DO $$
DECLARE
  dup_count INTEGER;
  dup_report TEXT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM users GROUP BY org_id, email HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    SELECT string_agg(format('org_id=%s email=%s (%s rows)', org_id, email, n), E'\n  ')
      INTO dup_report
    FROM (
      SELECT org_id, email, count(*) AS n
      FROM users
      GROUP BY org_id, email
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 20
    ) d;
    RAISE EXCEPTION E'0039 blocked: % duplicate (org_id, email) group(s) in users — uq_users_org_email cannot be created.\nResolve these manually (merge or deactivate accounts), then re-run db:migrate. First % group(s):\n  %',
      dup_count, LEAST(dup_count, 20), dup_report;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_email
  ON users (org_id, email);

DO $$
DECLARE
  dup_count INTEGER;
  dup_report TEXT;
  con_name TEXT;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM work_orders
    WHERE wo_number IS NOT NULL
    GROUP BY org_id, wo_number HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    SELECT string_agg(format('org_id=%s wo_number=%s (%s rows)', org_id, wo_number, n), E'\n  ')
      INTO dup_report
    FROM (
      SELECT org_id, wo_number, count(*) AS n
      FROM work_orders
      WHERE wo_number IS NOT NULL
      GROUP BY org_id, wo_number
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 20
    ) d;
    RAISE EXCEPTION E'0039 blocked: % duplicate (org_id, wo_number) group(s) in work_orders.\nResolve these manually, then re-run db:migrate. First % group(s):\n  %',
      dup_count, LEAST(dup_count, 20), dup_report;
  END IF;

  -- Drop the old GLOBAL unique constraint on wo_number (name varies by
  -- drizzle-kit generation era; locate by table + column instead).
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  WHERE c.contype = 'u'
    AND r.relname = 'work_orders'
    AND c.conkey = (
      SELECT array_agg(a.attnum ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = r.oid AND a.attname = 'wo_number'
    );
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE work_orders DROP CONSTRAINT %I', con_name);
  END IF;

  -- Some push-created databases carry the global unique as a standalone
  -- index rather than a constraint; if one is still present after the
  -- constraint drop, it is standalone and safe to remove.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'work_orders' AND indexname = 'work_orders_wo_number_unique'
  ) THEN
    DROP INDEX work_orders_wo_number_unique;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_org_wo_number
  ON work_orders (org_id, wo_number)
  WHERE wo_number IS NOT NULL;
