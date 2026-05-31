-- Task 242: Admin-portal hub access as an explicit per-account grant.
-- Cloud-only (PostgreSQL). Idempotent: safe to re-run; co-exists with a dev
-- column created by hand.
--
-- Mirrors the drizzle schema in shared/schema/core.ts:
--   hubAdmin:  boolean("hub_admin").notNull().default(false)
--   hubAccess: text("hub_access").array()      -- NULL = all hubs
--
-- `hub_admin` is a grant distinct from `role`: holding it (or being a
-- super-admin role, which is always-on at runtime) is what unlocks the
-- admin portal hubs. `hub_access` is the optional per-hub allow-list
-- (NULL = every hub).

ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_admin boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_access text[];

-- Backfill existing admin-portal accounts so this migration never locks an
-- established admin out of the hubs they could previously reach. Super-admin
-- roles are always-on at runtime regardless of the stored flag, but we set it
-- anyway for consistency. The remaining roles (chief_engineer, fleet_manager,
-- captain) currently land in the admin portal via the legacy role→portal map,
-- so they need the explicit grant to keep their access after this change.
UPDATE users
SET hub_admin = true
WHERE hub_admin = false
  AND lower(role) IN (
    'admin',
    'system_admin',
    'company_admin',
    'chief_engineer',
    'fleet_manager',
    'captain'
  );
