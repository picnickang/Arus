-- Manager-raised custom crew alerts
--
-- Adds the crew_alerts table so managers can raise ad-hoc alerts/notes against
-- a crew member (e.g. "follow up on visa", "performance review due") that live
-- alongside the expiry-derived certification/document alerts. Unlike those,
-- these carry no expiry-scan machinery — the severity is chosen by the manager
-- and the alert is acknowledged/resolved manually. Idempotent.

CREATE TABLE IF NOT EXISTS crew_alerts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id varchar NOT NULL REFERENCES organizations(id),
  crew_id varchar NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text,
  severity text NOT NULL DEFAULT 'notice',
  due_at timestamptz,
  created_by varchar(255),
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by varchar(255),
  acknowledged_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_alerts_org ON crew_alerts (org_id);
CREATE INDEX IF NOT EXISTS idx_crew_alerts_crew ON crew_alerts (crew_id);
