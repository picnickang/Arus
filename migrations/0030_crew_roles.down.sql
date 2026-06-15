-- Down: remove manageable crew roles. DROP TABLE cascades the table's
-- indexes, so we don't drop them explicitly: uq_crew_roles_org_name is a
-- UNIQUE *constraint* in a db:push baseline but a plain INDEX in a
-- migration-grown database, and `DROP INDEX` fails on the constraint form.
-- Dropping the table reverses the forward migration in either world.
DROP TABLE IF EXISTS crew_roles;
