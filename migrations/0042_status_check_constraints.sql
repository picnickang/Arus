-- 0042 — CHECK constraints for status/severity/priority columns
--
-- The schema has no pgEnum/CHECK enforcement anywhere: every status
-- column is raw text validated only in the app layer, so raw SQL, sync
-- jobs, and imports can write any string. This adds IN-list CHECKs for
-- the highest-value columns. Value sets were assembled from every
-- writer in the codebase (zod enums, workflow services, AMOS/Shipmate
-- import maps, raw SQL writers, client form options):
--
--   work_orders.status: open, planned, pending_approval, in_progress,
--     on_hold, awaiting_service, completed, closed, cancelled, overdue,
--     deferred
--   work_orders.priority: 1..4 (1=Critical .. 4=Low)
--   purchase_requests.status: draft, submitted, approved, ordered,
--     received, closed, cancelled        (PRStatus + transition map)
--   purchase_orders.status: draft, sent, confirmed, shipped, received,
--     completed, closed, cancelled
--   crew_alerts.severity: critical, warning, notice
--
-- Healing: only synonyms with code evidence are rewritten
-- ('pending' -> 'open' on work_orders — the read filter treats it as
-- open; priority clamped into 1..4). Unknown legacy values are NOT
-- rewritten: each CHECK is added as NOT VALID and only VALIDATEd when a
-- pre-count shows the table is clean, so new writes are enforced
-- immediately while a deploy never bricks on legacy tenant data (the
-- abort posture of 0039 is reserved for uniqueness, where
-- grandfathering is impossible). A NOTICE reports any rows left
-- grandfathered; VALIDATE manually after cleanup.

DO $$
DECLARE
  n INTEGER;
  spec RECORD;
  quoted TEXT;
  bad_count INTEGER;
BEGIN
  -- Heal known synonym before checking: 'pending' is read as open-ish by
  -- the work-order list filters and has no writer of its own.
  UPDATE work_orders SET status = 'open' WHERE status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    RAISE NOTICE '0042: work_orders — % row(s) healed pending -> open', n;
  END IF;

  -- Clamp out-of-range priorities into the 1..4 scale used everywhere.
  UPDATE work_orders SET priority = LEAST(GREATEST(priority, 1), 4)
  WHERE priority IS NOT NULL AND priority NOT BETWEEN 1 AND 4;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    RAISE NOTICE '0042: work_orders — % row(s) priority clamped into 1..4', n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_priority_valid') THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_priority_valid CHECK (priority BETWEEN 1 AND 4);
  END IF;

  FOR spec IN
    SELECT * FROM (VALUES
      ('work_orders', 'status', 'work_orders_status_valid',
       ARRAY['open','planned','pending_approval','in_progress','on_hold',
             'awaiting_service','completed','closed','cancelled','overdue','deferred']),
      ('purchase_requests', 'status', 'purchase_requests_status_valid',
       ARRAY['draft','submitted','approved','ordered','received','closed','cancelled']),
      ('purchase_orders', 'status', 'purchase_orders_status_valid',
       ARRAY['draft','sent','confirmed','shipped','received','completed','closed','cancelled']),
      ('crew_alerts', 'severity', 'crew_alerts_severity_valid',
       ARRAY['critical','warning','notice'])
    ) AS t(tbl, col, con, vals)
  LOOP
    SELECT string_agg(quote_literal(v), ', ') INTO quoted FROM unnest(spec.vals) AS v;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = spec.con) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I IN (%s)) NOT VALID',
        spec.tbl, spec.con, spec.col, quoted
      );
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I NOT IN (%s)',
      spec.tbl, spec.col, spec.col, quoted
    ) INTO bad_count;

    IF bad_count = 0 THEN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', spec.tbl, spec.con);
    ELSE
      RAISE NOTICE '0042: %.% left NOT VALID — % legacy row(s) outside the allowed set; clean up and run: ALTER TABLE % VALIDATE CONSTRAINT %',
        spec.tbl, spec.col, bad_count, spec.tbl, spec.con;
    END IF;
  END LOOP;
END $$;
