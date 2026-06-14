/**
 * Migration 032: RLS for pilot_feedback
 *
 * 031 created pilot_feedback after the 0045 RLS catch-up had already
 * shipped, so the table needs its own enablement. This lives in the
 * supplemental sequence (not a root NNNN_ migration) because the deploy
 * runner applies root migrations BEFORE server/migrations: a root RLS
 * migration would run before 031 creates the table, ledger itself as
 * applied, and never revisit — leaving the table permanently
 * unprotected. Here it is guaranteed to run after 031.
 *
 * Same fail-closed shape as 0018/0045: policy keys on
 * current_setting('app.current_org_id', true) (unset session == no
 * rows), FORCE covers the owner role, idempotent re-runs.
 *
 * Run: psql $DATABASE_URL -f 032-pilot-feedback-rls.sql
 */

DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = 'pilot_feedback'
  ) THEN
    RAISE EXCEPTION
      '032-pilot-feedback-rls: pilot_feedback does not exist — 031 must run first';
  END IF;

  ALTER TABLE pilot_feedback ENABLE ROW LEVEL SECURITY;
  ALTER TABLE pilot_feedback FORCE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema() AND tablename = 'pilot_feedback'
      AND policyname = 'tenant_isolation_pilot_feedback'
  ) THEN
    CREATE POLICY tenant_isolation_pilot_feedback ON pilot_feedback
      USING (org_id = current_setting('app.current_org_id', true))
      WITH CHECK (org_id = current_setting('app.current_org_id', true));
  END IF;
END
$rls$ LANGUAGE plpgsql;
