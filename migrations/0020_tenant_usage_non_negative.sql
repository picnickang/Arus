-- Task #106 — Stop tenant usage counters from going below zero.
--
-- The application-level clamp in `quotaService.incrementUsage` uses
-- `GREATEST(0, value + EXCLUDED.value)` so racing / double-fired /
-- replayed decrements (e.g. KB document deletes from task #89) cannot
-- drift the stored counter negative. This migration adds a DB-level
-- CHECK constraint as defense-in-depth: any future writer that
-- bypasses the service must also keep the invariant, or the INSERT /
-- UPDATE will fail loudly instead of silently widening the tenant's
-- effective quota.

DO $$
BEGIN
  -- Heal any pre-existing negative rows (should be none, but the
  -- CHECK constraint would otherwise reject the migration on a
  -- corrupted table).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'tenant_usage'
  ) THEN
    UPDATE tenant_usage SET value = 0 WHERE value < 0;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = 'tenant_usage'
         AND constraint_name = 'tenant_usage_value_non_negative'
    ) THEN
      ALTER TABLE tenant_usage
        ADD CONSTRAINT tenant_usage_value_non_negative
        CHECK (value >= 0);
    END IF;
  END IF;
END
$$;
