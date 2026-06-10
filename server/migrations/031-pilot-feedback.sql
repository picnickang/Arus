/**
 * Migration 031: Pilot Feedback
 *
 * Durable backend for the user-portal Feedback page. Crew reports
 * (bug / suggestion / flag) previously lived only in browser
 * sessionStorage and were lost on tab close. Mirrors the crew-tasks
 * pattern (PostgreSQL only, no SQLite mirror).
 *
 * user_id has no FK — dev-login sessions reference synthetic user ids.
 *
 * Run: psql $DATABASE_URL -f 031-pilot-feedback.sql
 */

CREATE TABLE IF NOT EXISTS pilot_feedback (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                VARCHAR NOT NULL REFERENCES organizations(id),
  user_id               VARCHAR NOT NULL,
  tracking_id           VARCHAR NOT NULL,
  category              TEXT NOT NULL,
  severity              TEXT NOT NULL,
  location              TEXT NOT NULL,
  subject               TEXT NOT NULL,
  description           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'submitted',
  resolution_note       TEXT,
  linked_work_order_id  VARCHAR,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_user
  ON pilot_feedback (org_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_status
  ON pilot_feedback (org_id, status);
