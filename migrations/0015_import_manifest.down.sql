-- Reverse migration for 0015_import_manifest.sql
-- Drops the SHIPMATE/AMOS import audit-trail table and its indexes.
-- Idempotent: every DROP uses IF EXISTS.

DROP INDEX IF EXISTS idx_import_manifest_started_at;
DROP INDEX IF EXISTS idx_import_manifest_vessel;
DROP INDEX IF EXISTS idx_import_manifest_org_status;
DROP TABLE IF EXISTS import_manifest;
