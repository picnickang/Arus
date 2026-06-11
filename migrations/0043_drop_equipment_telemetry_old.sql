-- ============================================================================
-- 0043 — drop equipment_telemetry_old (the pre-0038 backup) after soak
-- ============================================================================
--
-- 0038 partitioned equipment_telemetry and RETAINED the original table as
-- equipment_telemetry_old "for instant manual rollback ... drop it after a
-- soak period". This is that follow-up. The backup is frozen at its 0038
-- row count, costs its full size in storage, and — because it kept its
-- FORCE-RLS policy and indexes — is easy to mistake for the live table in
-- ad-hoc queries.
--
-- GUARDS (fail toward keeping the table; a kept backup costs storage, a
-- wrongly dropped one is unrecoverable):
--   * Absent table → NOTICE + skip (idempotent; fresh DBs never had it).
--   * The copy sanity check counts BOTH tables with row_security off:
--     both carry FORCE RLS, so an unpinned session would otherwise count
--     0 = 0 on both sides and the guard would pass vacuously. If the
--     migration role cannot bypass RLS (not superuser / no BYPASSRLS),
--     the count raises insufficient_privilege and we WARN + keep.
--   * parent < backup rows → WARN + keep. NOTE: the daily retention job
--     deletes expired rows from the parent but the backup is frozen, so
--     a long soak with retention enabled can legitimately trip this
--     guard. In that case verify manually and run
--     `DROP TABLE equipment_telemetry_old;` yourself — this migration
--     deliberately stays conservative.
--
-- Irreversible: the down file is an explanatory no-op. A rollback target
-- can be rebuilt from live data with 0038's down migration if ever needed.
-- ============================================================================

DO $drop_old$
DECLARE
  old_count bigint;
  new_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = current_schema()
       AND c.relname = 'equipment_telemetry_old'
       AND c.relkind = 'r'
  ) THEN
    RAISE NOTICE '0043: equipment_telemetry_old not present — nothing to drop';
    RETURN;
  END IF;

  BEGIN
    -- SET LOCAL semantics: reverts when this migration's transaction ends.
    PERFORM set_config('row_security', 'off', true);
    SELECT count(*) INTO old_count FROM equipment_telemetry_old;
    SELECT count(*) INTO new_count FROM equipment_telemetry;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE WARNING
      '0043: migration role cannot bypass row security to verify the 0038 copy — '
      'keeping equipment_telemetry_old. Verify counts as a superuser and drop manually.';
    RETURN;
  END;

  IF new_count < old_count THEN
    RAISE WARNING
      '0043: partitioned equipment_telemetry has % rows but the backup has % — '
      'either the 0038 copy is incomplete or retention has pruned the parent. '
      'Keeping equipment_telemetry_old; verify and drop manually.',
      new_count, old_count;
    RETURN;
  END IF;

  DROP TABLE equipment_telemetry_old;
  RAISE NOTICE '0043: dropped equipment_telemetry_old (backup had % rows; parent has %)',
    old_count, new_count;
END
$drop_old$;
