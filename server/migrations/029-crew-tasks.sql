/**
 * Migration 029: Crew Tasks
 *
 * Cloud-only crew task tracker — assignable tasks for crew members,
 * surfaced as the "Tasks" view inside Crew Management. A first-class
 * entity in its own table, NOT derived from work orders or maintenance
 * schedules. Mirrors the safety-bulletins pattern (PostgreSQL only, no
 * SQLite mirror).
 *
 * Null vessel_id        => not tied to a specific vessel.
 * Null assigned_crew_id => unassigned task.
 *
 * Run: psql $DATABASE_URL -f 029-crew-tasks.sql
 */

CREATE TABLE IF NOT EXISTS crew_tasks (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id        VARCHAR REFERENCES vessels(id),
  assigned_crew_id VARCHAR REFERENCES crew(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'open',
  priority         TEXT NOT NULL DEFAULT 'medium',
  due_date         TIMESTAMP,
  blocked_reason   TEXT,
  created_by       VARCHAR,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_tasks_org_status
  ON crew_tasks (org_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_crew_tasks_org_assigned
  ON crew_tasks (org_id, assigned_crew_id);
