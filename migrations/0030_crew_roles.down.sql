-- Down: remove manageable crew roles
DROP INDEX IF EXISTS uq_crew_roles_org_name;
DROP INDEX IF EXISTS idx_crew_roles_org;
DROP TABLE IF EXISTS crew_roles;
