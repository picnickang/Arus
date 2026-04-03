/**
 * Migration 006: Certificate Registry + Hazmat Parts + Dev Mode Guard
 *
 * Phase 1 Regulatory Blockers (Task #36):
 *   1. Equipment certificate registry (class, statutory, flag state)
 *   2. Hazmat/IMDG classification fields on inventory parts
 *   3. Dev mode permission bypass build-time guard (frontend-only)
 *
 * Run: psql $DATABASE_URL -f 006-certificates-hazmat-devmode.sql
 */

-- PART 1: Equipment Certificate Registry

CREATE TABLE IF NOT EXISTS vessel_certificates (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),
  certificate_type    TEXT NOT NULL,
  certificate_number  TEXT,
  certificate_name    TEXT NOT NULL,
  issuing_authority   TEXT NOT NULL,
  issuing_authority_type TEXT NOT NULL DEFAULT 'class_society',
  issue_date          TIMESTAMPTZ NOT NULL,
  expiry_date         TIMESTAMPTZ,
  last_survey_date      TIMESTAMPTZ,
  next_survey_due       TIMESTAMPTZ,
  survey_window_start   TIMESTAMPTZ,
  survey_window_end     TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'valid',
  conditions_of_class JSONB DEFAULT '[]',
  endorsements        JSONB DEFAULT '[]',
  survey_id           VARCHAR,
  equipment_id        VARCHAR REFERENCES equipment(id),
  document_url        TEXT,
  notes               TEXT,
  created_by          VARCHAR,
  updated_by          VARCHAR,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessel_certs_org_vessel ON vessel_certificates (org_id, vessel_id);
CREATE INDEX IF NOT EXISTS idx_vessel_certs_expiry ON vessel_certificates (org_id, expiry_date) WHERE status = 'valid';
CREATE INDEX IF NOT EXISTS idx_vessel_certs_survey_due ON vessel_certificates (org_id, next_survey_due) WHERE status = 'valid';
CREATE INDEX IF NOT EXISTS idx_vessel_certs_type ON vessel_certificates (certificate_type, status);
CREATE INDEX IF NOT EXISTS idx_vessel_certs_status ON vessel_certificates (org_id, status);

CREATE TABLE IF NOT EXISTS certificate_events (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  certificate_id  VARCHAR NOT NULL REFERENCES vessel_certificates(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  user_id         VARCHAR,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_events_cert ON certificate_events (certificate_id, created_at DESC);

-- PART 2: Hazmat / IMDG Classification Fields on Parts

ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS imo_dg_class        TEXT,
  ADD COLUMN IF NOT EXISTS un_number           TEXT,
  ADD COLUMN IF NOT EXISTS imdg_code           TEXT,
  ADD COLUMN IF NOT EXISTS is_hazmat           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hazmat_handling      TEXT,
  ADD COLUMN IF NOT EXISTS shelf_life_days     INTEGER,
  ADD COLUMN IF NOT EXISTS customs_tariff_code TEXT,
  ADD COLUMN IF NOT EXISTS msds_url            TEXT;

CREATE INDEX IF NOT EXISTS idx_parts_hazmat ON parts (is_hazmat, imo_dg_class) WHERE is_hazmat = true;
CREATE INDEX IF NOT EXISTS idx_parts_shelf_life ON parts (shelf_life_days) WHERE shelf_life_days IS NOT NULL;

-- PART 3: Comments
COMMENT ON TABLE vessel_certificates IS 'Statutory and class certificates for vessels. Tracks validity, survey windows, conditions of class, and flag state endorsements.';
COMMENT ON COLUMN parts.imo_dg_class IS 'IMO Dangerous Goods class (1-9 with subdivisions). Required for IMDG Code compliance.';
COMMENT ON COLUMN parts.shelf_life_days IS 'Shelf life in days from manufacture. Null means no expiry.';
