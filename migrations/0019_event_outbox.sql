-- ============================================================================
-- 0019  Push B3 — Event-Streaming Spine: transactional outbox table
-- ============================================================================
-- Backing storage for the publish-after-commit outbox pattern used by the
-- event-streaming spine. The application enqueues an outbox row inside the
-- same transaction as the domain write; an out-of-process worker claims
-- pending rows (FOR UPDATE SKIP LOCKED), publishes the envelope onto the
-- streaming substrate (Kafka/Redpanda), and marks them dispatched. The
-- bridge into the existing in-process bus also writes here — the
-- (event_id) unique index keeps it idempotent across both write paths.
--
-- DESIGN
--   * `event_id` is the application-generated envelope id and is UNIQUE so
--     re-emits (bridge + native publisher, retried producer, replay) all
--     collapse onto the same row.
--   * `status` is the FSM: pending -> dispatching -> published | failed.
--     Terminal transitions in the worker are guarded by
--     `status = 'dispatching'` so a reaped row cannot be marked twice.
--   * `next_attempt_at` schedules retries with backoff; `dispatched_at`
--     records when the worker claimed the row so the reaper can recycle
--     stuck rows by elapsed dispatch time (not by next-attempt).
--   * The pending index drives the claim CTE; the org+event index keeps
--     the per-org head-of-line ordering guard cheap.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "event_outbox" (
  "id"               varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id"         varchar     NOT NULL,
  "event_type"       text        NOT NULL,
  "org_id"           varchar     NOT NULL,
  "aggregate_id"     varchar,
  "aggregate_type"   text,
  "payload"          jsonb       NOT NULL,
  "occurred_at"      timestamp   NOT NULL DEFAULT now(),
  "status"           text        NOT NULL DEFAULT 'pending',
  "attempts"         integer     NOT NULL DEFAULT 0,
  "last_error"       text,
  "next_attempt_at"  timestamp   NOT NULL DEFAULT now(),
  "dispatched_at"    timestamp,
  "published_at"     timestamp,
  "created_at"       timestamp   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_event_outbox_event_id"
  ON "event_outbox" ("event_id");

CREATE INDEX IF NOT EXISTS "idx_event_outbox_pending"
  ON "event_outbox" ("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "idx_event_outbox_org_event"
  ON "event_outbox" ("org_id", "event_type");
