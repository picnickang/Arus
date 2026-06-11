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
  tracking_id           VARCHAR NOT NULL UNIQUE,
  category              TEXT NOT NULL
    CONSTRAINT pilot_feedback_category_check
    CHECK (category IN ('bug', 'suggestion', 'flag')),
  severity              TEXT NOT NULL
    CONSTRAINT pilot_feedback_severity_check
    CHECK (severity IN ('low', 'medium', 'high')),
  location              TEXT NOT NULL
    CONSTRAINT pilot_feedback_location_check
    CHECK (location IN ('engine_room', 'bridge', 'deck', 'accommodation', 'cargo_hold', 'other')),
  subject               TEXT NOT NULL,
  description           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'submitted'
    CONSTRAINT pilot_feedback_status_check
    CHECK (status IN ('submitted', 'acknowledged', 'resolved')),
  resolution_note       TEXT,
  -- SET NULL: deleting a work order must never erase the crew report.
  linked_work_order_id  VARCHAR REFERENCES work_orders(id) ON DELETE SET NULL,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_user
  ON pilot_feedback (org_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org_status
  ON pilot_feedback (org_id, status);
