-- Rollback Task #359 role-level hub access.
ALTER TABLE roles DROP COLUMN IF EXISTS hub_access;
ALTER TABLE roles DROP COLUMN IF EXISTS hub_admin;
