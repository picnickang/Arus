-- Reverse migration for 0020_tenant_usage_non_negative.sql
-- Drops the defense-in-depth CHECK constraint on tenant_usage.value.
-- The application-level clamp in quotaService.incrementUsage still
-- prevents negative values; this removes only the DB-level guard.
-- Idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'tenant_usage'
  ) THEN
    ALTER TABLE tenant_usage
      DROP CONSTRAINT IF EXISTS tenant_usage_value_non_negative;
  END IF;
END
$$;
