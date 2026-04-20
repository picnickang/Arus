-- ============================================================================
-- Launch P0 Migration: SHIPMATE import audit trail
--
-- Creates `import_manifest` — one row per SHIPMATE/AMOS import attempt,
-- recorded inside the import transaction so the operator can answer
-- "what was actually imported?" after the fact.
--
-- Without this table, a mid-import crash leaves the vessel DB in an
-- undocumented partial state. With it, recovery is: read the manifest,
-- see status=failed/rolled_back, know exactly what didn't make it in.
-- ============================================================================

CREATE TABLE IF NOT EXISTS import_manifest (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,

  source_system TEXT NOT NULL,
  module TEXT NOT NULL,
  filename TEXT,

  vessel_id VARCHAR,
  vessel_name_requested TEXT,

  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,

  rows_total INTEGER DEFAULT 0,
  rows_imported INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,

  error_message TEXT,
  first_errors JSONB,

  initiated_by VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_import_manifest_org_status
  ON import_manifest (org_id, status);

CREATE INDEX IF NOT EXISTS idx_import_manifest_vessel
  ON import_manifest (vessel_id);

CREATE INDEX IF NOT EXISTS idx_import_manifest_started_at
  ON import_manifest (started_at);
