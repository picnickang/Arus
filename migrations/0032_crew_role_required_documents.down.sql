-- Rollback Task #349 per-role required document types.
ALTER TABLE crew_roles DROP COLUMN IF EXISTS required_documents;
