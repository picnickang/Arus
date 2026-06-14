-- ============================================================================
-- 0046  org_id foreign-key backfill — every tenant column references
--       organizations(id)
-- ============================================================================
-- The TS schema now declares `.references(() => organizations.id)` on all
-- ~250 org_id columns (push-bootstrapped databases get the constraints from
-- drizzle-kit), but databases that grew via migrations predate most of those
-- declarations: only a handful of org FKs exist (0018's quota tables, 0040's
-- ML tables, a few drizzle-era ones). Without the constraint, a buggy writer
-- or raw import can insert rows for a non-existent org — invisible to RLS
-- (no policy row matches) and unreachable by GDPR delete.
--
-- DESIGN
--   * One DO loop discovers org_id columns lacking an FK to organizations
--     from the catalogs, so the migration is self-maintaining and idempotent
--     (re-runs find nothing to do).
--   * Regular tables: ADD CONSTRAINT fk_<table>_org ... NOT VALID — new
--     writes are enforced immediately, no full-table scan under lock. Then
--     an orphan pre-count: 0 → VALIDATE CONSTRAINT; >0 → RAISE NOTICE and
--     leave NOT VALID (0042 posture: a deploy never bricks on legacy rows;
--     clean up and VALIDATE manually).
--   * Partitioned parents (equipment_telemetry): Postgres < 18 cannot
--     ADD FOREIGN KEY ... NOT VALID on a partitioned table. Orphan
--     pre-count: 0 → plain ADD CONSTRAINT (validates by scanning — see
--     operational note); >0 → NOTICE and skip entirely.
--   * Delete rule: NO ACTION (default). GDPR tenant delete walks children
--     first and never deletes the organizations row, so NO ACTION never
--     fires in that path — and it blocks any stray `DELETE FROM
--     organizations` while tenant rows remain, forcing the audited path.
--     The pre-existing CASCADE org FKs (tenant_quotas/tenant_usage from
--     0018, a few analytics tables) are left untouched.
--
-- OPERATIONAL NOTE
--   Each ADD CONSTRAINT takes a brief ACCESS EXCLUSIVE lock; the runner
--   wraps the whole file in one transaction, so ~230 locks accumulate
--   until COMMIT, and the equipment_telemetry FK (if added) scans the
--   partitions. Run via `npm run db:migrate:deploy` in a maintenance
--   window rather than MIGRATE_ON_BOOT (0041 precedent).

DO $fk$
DECLARE
  rec        RECORD;
  conname    text;
  n_orphans  bigint;
BEGIN
  FOR rec IN
    SELECT c.relname AS tbl, c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'org_id'
     WHERE n.nspname = current_schema()
       AND c.relkind IN ('r', 'p')
       AND NOT c.relispartition
       AND c.relname <> 'organizations'
       AND NOT a.attisdropped
       AND NOT EXISTS (
             SELECT 1
               FROM pg_constraint fk
              WHERE fk.conrelid = c.oid
                AND fk.contype = 'f'
                AND fk.confrelid = 'organizations'::regclass
                AND a.attnum = ANY (fk.conkey)
           )
     ORDER BY c.relname
  LOOP
    conname := 'fk_' || rec.tbl || '_org';

    EXECUTE format(
      'SELECT count(*) FROM %I t WHERE t.org_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = t.org_id)',
      rec.tbl
    ) INTO n_orphans;

    IF rec.relkind = 'p' THEN
      -- Partitioned parent: NOT VALID unsupported (< PG18). Add validated
      -- only when clean; otherwise report and skip.
      IF n_orphans = 0 THEN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES organizations(id)',
          rec.tbl, conname
        );
      ELSE
        RAISE NOTICE
          '0046: %.org_id has % orphaned row(s) and is partitioned — FK skipped; clean up and re-run db:migrate',
          rec.tbl, n_orphans;
      END IF;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID',
      rec.tbl, conname
    );

    IF n_orphans = 0 THEN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', rec.tbl, conname);
    ELSE
      RAISE NOTICE
        '0046: %.org_id left NOT VALID — % orphaned row(s) reference missing orgs; clean up and run: ALTER TABLE % VALIDATE CONSTRAINT %',
        rec.tbl, n_orphans, rec.tbl, conname;
    END IF;
  END LOOP;
END
$fk$ LANGUAGE plpgsql;
