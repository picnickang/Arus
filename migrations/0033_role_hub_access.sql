-- Task #359: role-level admin-portal ("hub") access.
-- Makes admin-hub access a property of the ROLE (mirroring the user-level
-- columns on `users`) so it can be managed per role in Crew → Roles & Dashboards
-- and drive each user's post-login landing. Additive + nullable, so existing
-- rows are untouched; non-admin roles default to no hub access.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hub_admin boolean NOT NULL DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hub_access text[];

-- Idempotent backfill: built-in admin/system roles keep full hub access.
-- hub_admin = true with a NULL hub_access list means "all hubs" (super-admin
-- semantics). Re-running only flips rows that are not already admins, so it is
-- safe for already-seeded orgs (provisioning only touches new orgs).
UPDATE roles
   SET hub_admin = true
 WHERE name IN ('super_admin', 'admin', 'system_admin', 'company_admin')
   AND hub_admin = false;
