-- ============================================================================
-- 0034  Access & Permissions consolidation
-- ============================================================================
-- Supports the unified "Access & Permissions" page:
--   1. New per-account dashboard personalization table
--      (`user_dashboard_preferences`) + RLS, matching the cloud-only
--      role-dashboards domain.
--   2. Demote the regular `admin` role from "all hubs": give it an explicit
--      curated hub_access default so it only reaches the admin hub plus a
--      sensible working set, instead of falling through to the all-hubs path
--      when hub_access IS NULL.
--   3. No-lockout bootstrap: in any org that has admin users but ZERO
--      super_admin users, promote those admins to super_admin so at least one
--      real login keeps full control once `admin` stops being a super tier.
--
-- All steps are idempotent and guarded so re-running is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Per-account dashboard preferences (cloud-only, org-scoped, RLS).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     varchar NOT NULL REFERENCES organizations(id),
  user_id    varchar NOT NULL,
  prefs_json jsonb   NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_dashboard_prefs
  ON user_dashboard_preferences (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_prefs_org_user
  ON user_dashboard_preferences (org_id, user_id);

DO $prefs_rls$
BEGIN
  EXECUTE 'ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE user_dashboard_preferences FORCE ROW LEVEL SECURITY';
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'user_dashboard_preferences'
      AND policyname = 'tenant_isolation_user_dashboard_preferences'
  ) THEN
    EXECUTE
      'CREATE POLICY tenant_isolation_user_dashboard_preferences
         ON user_dashboard_preferences
         USING (org_id = current_setting(''app.current_org_id'', true))
         WITH CHECK (org_id = current_setting(''app.current_org_id'', true))';
  END IF;
END
$prefs_rls$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Curated default hub_access for the regular `admin` role.
--    Only touch rows still on the 0033 default (hub_access IS NULL) so we never
--    clobber an explicit operator choice. The true super tier
--    (super_admin/system_admin/company_admin) is left untouched — those always
--    resolve to all hubs in code regardless of this column.
-- ----------------------------------------------------------------------------
DO $admin_hubs$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'roles' AND column_name = 'hub_access'
  ) THEN
    EXECUTE $sql$
      UPDATE roles
         SET hub_access = ARRAY['system','operations']
       WHERE lower(name) = 'admin'
         AND hub_access IS NULL
    $sql$;
  END IF;
END
$admin_hubs$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. No-lockout super-admin bootstrap.
--    For every org that has at least one admin user but no super_admin user,
--    promote the admin(s) to super_admin so full control is preserved before
--    `admin` is demoted out of the always-super tier.
-- ----------------------------------------------------------------------------
DO $bootstrap$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users' AND column_name = 'role'
  ) THEN
    EXECUTE $sql$
      UPDATE users u
         SET role = 'super_admin'
       WHERE lower(u.role) = 'admin'
         AND NOT EXISTS (
           SELECT 1 FROM users s
            WHERE s.org_id = u.org_id
              AND lower(s.role) = 'super_admin'
         )
    $sql$;
  END IF;
END
$bootstrap$ LANGUAGE plpgsql;
