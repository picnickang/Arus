-- 0039 down — remove tenant-scoped identity unique indexes
--
-- Restoring the old GLOBAL wo_number unique is best-effort: if different
-- orgs created identical wo_numbers while the org-scoped index was live,
-- the global constraint can no longer hold and is skipped with a NOTICE.
-- users had no email uniqueness before 0039, so nothing is restored there.

DROP INDEX IF EXISTS uq_users_org_email;
DROP INDEX IF EXISTS uq_work_orders_org_wo_number;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    WHERE c.contype = 'u'
      AND r.relname = 'work_orders'
      AND c.conkey = (
        SELECT array_agg(a.attnum ORDER BY a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = r.oid AND a.attname = 'wo_number'
      )
  ) THEN
    BEGIN
      ALTER TABLE work_orders
        ADD CONSTRAINT work_orders_wo_number_unique UNIQUE (wo_number);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE '0039 down: skipped restoring global wo_number unique — cross-org duplicate wo_numbers now exist';
    END;
  END IF;
END $$;
