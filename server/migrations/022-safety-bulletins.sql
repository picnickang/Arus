/**
 * Migration 022: Safety Bulletins
 *
 * Cloud-only safety bulletins (notices) feed backing the user-portal
 * dashboard's "Safety Notices" + "Safety Status" cards. Mirrors the
 * certificates pattern (cloud/PostgreSQL only, no SQLite mirror).
 *
 * Null vessel_id => fleet-wide bulletin visible to every vessel.
 *
 * Run: psql $DATABASE_URL -f 022-safety-bulletins.sql
 */

CREATE TABLE IF NOT EXISTS safety_bulletins (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR REFERENCES vessels(id),
  title           TEXT NOT NULL,
  body            TEXT,
  severity        TEXT NOT NULL DEFAULT 'info',
  category        TEXT NOT NULL DEFAULT 'general',
  reference       TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date  TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP,
  created_by      VARCHAR,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_bulletins_org_active
  ON safety_bulletins (org_id, active, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_safety_bulletins_org_vessel
  ON safety_bulletins (org_id, vessel_id);
