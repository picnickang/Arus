-- Migration 030: Crew task — assigned-to owner, linked source, activity log
--
-- Extends the crew-tasks domain (created in 029) to match the agreed task
-- tracker template:
--   * assigned_to        — the owner/actor responsible (distinct from the
--                          crew member the task is about, `assigned_crew_id`)
--   * linked_source_*    — optional reference to an existing crew document /
--                          certificate (the "linked source")
--   * crew_task_events   — activity log: auto system events + user comments
--
-- Cloud-only (PostgreSQL); no SQLite mirror. Applied once by
-- `server/scripts/migrate.ts` (tracked in arus_sql_migrations). Idempotent so
-- a re-run is a no-op.
--
-- ROLLBACK (apply manually — the server/migrations runner applies every *.sql
-- file forward, so a separate *.down.sql here would be mis-applied as an UP):
--   DROP TABLE IF EXISTS crew_task_events;
--   ALTER TABLE crew_tasks DROP COLUMN IF EXISTS assigned_to;
--   ALTER TABLE crew_tasks DROP COLUMN IF EXISTS linked_source_type;
--   ALTER TABLE crew_tasks DROP COLUMN IF EXISTS linked_source_id;
--   ALTER TABLE crew_tasks DROP COLUMN IF EXISTS linked_source_label;

ALTER TABLE crew_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE crew_tasks ADD COLUMN IF NOT EXISTS linked_source_type TEXT;
ALTER TABLE crew_tasks ADD COLUMN IF NOT EXISTS linked_source_id VARCHAR;
ALTER TABLE crew_tasks ADD COLUMN IF NOT EXISTS linked_source_label TEXT;

CREATE TABLE IF NOT EXISTS crew_task_events (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       VARCHAR NOT NULL REFERENCES organizations(id),
  task_id      VARCHAR NOT NULL REFERENCES crew_tasks(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  message      TEXT NOT NULL,
  actor_id     VARCHAR,
  actor_name   TEXT,
  actor_role   TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_task_events_task
  ON crew_task_events (task_id, created_at);
