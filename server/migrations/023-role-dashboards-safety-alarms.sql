/**
 * Migration 023: Role Dashboards, User Vessel Assignments, Safety Alarms,
 *                and regular-user credential columns.
 *
 * Cloud-only (PostgreSQL) — supports the role-aware configurable User page,
 * admin Crew Management surface, and regular-user credential login.
 * Idempotent: safe to re-run.
 *
 * Run: psql $DATABASE_URL -f 023-role-dashboards-safety-alarms.sql
 */

-- Regular-user credential columns on the existing users table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Per-role User-page dashboard config (validated JSON).
CREATE TABLE IF NOT EXISTS role_dashboard_configs (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      VARCHAR NOT NULL REFERENCES organizations(id),
  role_id     VARCHAR NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  config_json JSONB NOT NULL,
  updated_by  VARCHAR,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_role_dashboard_org_role UNIQUE (org_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_dashboard_org ON role_dashboard_configs (org_id);

-- Which vessel(s)/fleet + department a user is assigned to.
CREATE TABLE IF NOT EXISTS user_vessel_assignments (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      VARCHAR NOT NULL REFERENCES organizations(id),
  user_id     VARCHAR NOT NULL,
  vessel_id   VARCHAR REFERENCES vessels(id),
  department  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by VARCHAR,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_user_vessel UNIQUE (org_id, user_id, vessel_id)
);

CREATE INDEX IF NOT EXISTS idx_user_vessel_org_user ON user_vessel_assignments (org_id, user_id);

-- Configurable emergency alarm types.
CREATE TABLE IF NOT EXISTS safety_alarm_types (
  id                       VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   VARCHAR NOT NULL REFERENCES organizations(id),
  key                      TEXT NOT NULL,
  display_name             TEXT NOT NULL,
  description              TEXT,
  default_severity         TEXT NOT NULL DEFAULT 'critical',
  icon                     TEXT,
  color                    TEXT,
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT TRUE,
  is_protected             BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_by               VARCHAR,
  created_at               TIMESTAMP DEFAULT NOW(),
  updated_at               TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_safety_alarm_type_org_key UNIQUE (org_id, key)
);

CREATE INDEX IF NOT EXISTS idx_safety_alarm_type_org_active
  ON safety_alarm_types (org_id, is_active);

-- Active/cleared vessel or fleet-wide emergency alarms.
CREATE TABLE IF NOT EXISTS vessel_safety_alarms (
  id                       VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   VARCHAR NOT NULL REFERENCES organizations(id),
  alarm_type_id            VARCHAR NOT NULL REFERENCES safety_alarm_types(id),
  vessel_id                VARCHAR REFERENCES vessels(id),
  title                    TEXT NOT NULL,
  message                  TEXT,
  severity                 TEXT NOT NULL DEFAULT 'critical',
  mode                     TEXT NOT NULL DEFAULT 'real',
  status                   TEXT NOT NULL DEFAULT 'active',
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT TRUE,
  triggered_by             VARCHAR,
  triggered_by_name        TEXT,
  triggered_at             TIMESTAMP DEFAULT NOW(),
  cleared_by               VARCHAR,
  cleared_by_name          TEXT,
  cleared_at               TIMESTAMP,
  created_at               TIMESTAMP DEFAULT NOW(),
  updated_at               TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessel_safety_alarm_org_status
  ON vessel_safety_alarms (org_id, status, triggered_at);
CREATE INDEX IF NOT EXISTS idx_vessel_safety_alarm_org_vessel
  ON vessel_safety_alarms (org_id, vessel_id);

-- Alarm acknowledgements (one per user per alarm).
CREATE TABLE IF NOT EXISTS vessel_safety_alarm_acknowledgements (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  alarm_id        VARCHAR NOT NULL REFERENCES vessel_safety_alarms(id) ON DELETE CASCADE,
  user_id         VARCHAR NOT NULL,
  user_name       TEXT,
  source          TEXT,
  comment         TEXT,
  acknowledged_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_alarm_ack_alarm_user UNIQUE (alarm_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_alarm_ack_alarm ON vessel_safety_alarm_acknowledgements (alarm_id);

-- Idempotently seed the protected (built-in) emergency alarm types for every
-- org that already exists. New orgs are seeded on demand at runtime by
-- SafetyAlarmService.ensureProtectedTypes(); this block covers orgs present at
-- migration time so the catalogue is never empty after deploy. The keys/labels
-- below mirror PROTECTED_ALARM_TYPES in shared/role-dashboard.ts.
--
-- Protected ROLES are intentionally NOT seeded here: roles are org-scoped and
-- carry required metadata (display name, permission grants) owned by the
-- application setup/bootstrap path, so static SQL cannot create complete role
-- rows. The bootstrap remains the single source of truth for role creation.
INSERT INTO safety_alarm_types
  (org_id, key, display_name, default_severity, requires_acknowledgement, is_protected, is_active)
SELECT o.id, t.key, t.display_name, t.default_severity, TRUE, TRUE, TRUE
FROM organizations o
CROSS JOIN (VALUES
  ('fire_alarm',             'Fire Alarm',                'emergency'),
  ('man_overboard',          'Man Overboard',             'emergency'),
  ('abandon_vessel',         'Abandon Vessel',            'emergency'),
  ('medical_emergency',      'Medical Emergency',         'critical'),
  ('collision_grounding',    'Collision / Grounding',     'emergency'),
  ('flooding_water_ingress', 'Flooding / Water Ingress',  'emergency'),
  ('engine_room_emergency',  'Engine Room Emergency',     'critical'),
  ('security_threat',        'Security Threat',           'critical'),
  ('gas_leak',               'Gas Leak',                  'critical'),
  ('machinery_emergency',    'Machinery Emergency',       'critical'),
  ('evacuation',             'Evacuation',                'emergency'),
  ('muster_alarm',           'Muster Alarm',              'critical'),
  ('general_emergency',      'General Emergency',          'emergency')
) AS t(key, display_name, default_severity)
ON CONFLICT (org_id, key) DO NOTHING;
